package usecase

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"time"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

type TaskChangeRequestUsecase struct {
	changeRequestRepo interfaces.TaskChangeRequestRepository
	notificationRepo  interfaces.NotificationRepository
	taskRepo          interfaces.TaskRepository
	projectRepo       interfaces.ProjectRepository
	userRepo          interfaces.UserRepository
	taskUsecase       *TaskUsecase
	accessService     *AccessService
	cacheService      interfaces.CacheService
	activity          *ActivityUsecase
}

type CreateTaskChangeRequestInput struct {
	Title       *string
	Description *string
	Status      *string
	Priority    *string
	AssigneeIDs OptionalUintSliceInput
	Deadline    OptionalTimeInput
	ReminderAt  OptionalTimeInput
	Reason      string
}

type ReviewTaskChangeRequestInput struct {
	ReviewNote string
}

type TaskChangeRequestOutput struct {
	ID            uint                   `json:"id"`
	TaskID        uint                   `json:"task_id"`
	ProjectID     uint                   `json:"project_id"`
	RequestedBy   uint                   `json:"requested_by"`
	Requester     *UserReferenceOutput   `json:"requester,omitempty"`
	Payload       map[string]interface{} `json:"payload"`
	CurrentValues map[string]interface{} `json:"current_values"`
	Reason        string                 `json:"reason"`
	TaskUpdatedAt *time.Time             `json:"task_updated_at"`
	Conflict      bool                   `json:"conflict"`
	Status        string                 `json:"status"`
	ReviewedBy    *uint                  `json:"reviewed_by"`
	ReviewedAt    *time.Time             `json:"reviewed_at"`
	ReviewNote    string                 `json:"review_note"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

type UserReferenceOutput struct {
	ID    uint   `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type CreateTaskChangeRequestResult struct {
	Request       *TaskChangeRequestOutput `json:"request"`
	Notifications []NotificationOutput     `json:"notifications"`
}

type ReviewTaskChangeRequestResult struct {
	Request       *TaskChangeRequestOutput `json:"request"`
	Task          *TaskOutput              `json:"task,omitempty"`
	Notifications []NotificationOutput     `json:"notifications"`
}

type changeRequestListCacheEntry struct {
	Data  []TaskChangeRequestOutput `json:"data"`
	Total int64                     `json:"total"`
}

func NewTaskChangeRequestUsecase(
	changeRequestRepo interfaces.TaskChangeRequestRepository,
	notificationRepo interfaces.NotificationRepository,
	taskRepo interfaces.TaskRepository,
	projectRepo interfaces.ProjectRepository,
	userRepo interfaces.UserRepository,
	taskUsecase *TaskUsecase,
	accessService *AccessService,
	cacheService interfaces.CacheService,
) *TaskChangeRequestUsecase {
	return &TaskChangeRequestUsecase{
		changeRequestRepo: changeRequestRepo,
		notificationRepo:  notificationRepo,
		taskRepo:          taskRepo,
		projectRepo:       projectRepo,
		userRepo:          userRepo,
		taskUsecase:       taskUsecase,
		accessService:     accessService,
		cacheService:      cacheService,
	}
}

func (uc *TaskChangeRequestUsecase) SetActivityUsecase(activity *ActivityUsecase) {
	uc.activity = activity
}

func (uc *TaskChangeRequestUsecase) Create(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
	input CreateTaskChangeRequestInput,
) (*CreateTaskChangeRequestResult, error) {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}

	if err := uc.accessService.CanViewProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
		return nil, err
	}

	hasPendingRequest, err := uc.changeRequestRepo.HasPendingByTaskAndRequester(ctx, task.ID, actorID)
	if err != nil {
		return nil, err
	}
	if hasPendingRequest {
		return nil, errors.New("you already have a pending change request for this task")
	}

	payload, err := uc.buildRequestedChanges(ctx, task, input)
	if err != nil {
		return nil, err
	}
	if len(payload) == 0 {
		return nil, errors.New("change request must include at least one change")
	}

	request := &domain.TaskChangeRequest{
		TaskID:        task.ID,
		ProjectID:     task.ProjectID,
		RequestedBy:   actorID,
		PayloadJSON:   encodePayload(payload),
		Reason:        strings.TrimSpace(input.Reason),
		TaskUpdatedAt: &task.UpdatedAt,
		Status:        domain.TaskChangeRequestStatusPending,
	}

	if err := uc.changeRequestRepo.Create(ctx, request); err != nil {
		return nil, err
	}

	requester := uc.userReference(ctx, actorID)
	notifications, err := uc.createManagerNotifications(ctx, request, task, requester)
	if err != nil {
		return nil, err
	}
	requesterNotifications, err := uc.createRequesterPendingNotification(ctx, request, task)
	if err != nil {
		return nil, err
	}
	notifications = append(notifications, requesterNotifications...)

	uc.invalidateChangeRequestCaches(ctx, request.ID, request.ProjectID, request.TaskID, actorID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeChangeRequestCreated, "Đã gửi yêu cầu thay đổi công việc.", request, task, map[string]interface{}{
		"change_request_id": request.ID,
		"requested_changes": payload,
		"reason":            request.Reason,
	})

	return &CreateTaskChangeRequestResult{
		Request:       uc.toTaskChangeRequestOutput(ctx, request),
		Notifications: notifications,
	}, nil
}

func (uc *TaskChangeRequestUsecase) GetByID(
	ctx context.Context,
	actorID uint,
	globalRole string,
	requestID uint,
) (*TaskChangeRequestOutput, error) {
	request, err := uc.changeRequestRepo.GetByID(ctx, requestID)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, errors.New("change request not found")
	}

	if err := uc.canViewRequest(ctx, actorID, globalRole, request); err != nil {
		return nil, err
	}

	return uc.toTaskChangeRequestOutput(ctx, request), nil
}

func (uc *TaskChangeRequestUsecase) ListByTask(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
	page int,
	pageSize int,
) ([]TaskChangeRequestOutput, int64, error) {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, 0, err
	}
	if task == nil {
		return nil, 0, errors.New("task not found")
	}

	if err := uc.accessService.CanViewProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
		return nil, 0, err
	}

	var requesterID *uint
	visibility := "all"
	if !uc.canManageProject(ctx, actorID, globalRole, task.ProjectID) {
		requesterID = &actorID
		visibility = fmt.Sprintf("user:%d", actorID)
	}

	page, pageSize = normalizePagination(page, pageSize)
	cacheKey := fmt.Sprintf("task:%d:change-requests:%s:page:%d:size:%d", taskID, visibility, page, pageSize)

	var cached changeRequestListCacheEntry
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached.Data, cached.Total, nil
	}

	requests, total, err := uc.changeRequestRepo.ListByTask(ctx, taskID, requesterID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	result := make([]TaskChangeRequestOutput, 0, len(requests))
	for _, request := range requests {
		result = append(result, *uc.toTaskChangeRequestOutputWithTask(ctx, request, task))
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, changeRequestListCacheEntry{
		Data:  result,
		Total: total,
	}, readCacheTTL)

	return result, total, nil
}

func (uc *TaskChangeRequestUsecase) Approve(
	ctx context.Context,
	reviewerID uint,
	globalRole string,
	requestID uint,
	input ReviewTaskChangeRequestInput,
) (*ReviewTaskChangeRequestResult, error) {
	request, err := uc.getPendingRequest(ctx, requestID)
	if err != nil {
		return nil, err
	}

	if err := uc.accessService.CanManageProject(ctx, request.ProjectID, reviewerID, globalRole); err != nil {
		return nil, err
	}

	currentTask, err := uc.taskRepo.GetByID(ctx, request.TaskID)
	if err != nil {
		return nil, err
	}
	if currentTask == nil {
		return nil, errors.New("task not found")
	}
	if request.TaskUpdatedAt != nil && currentTask.UpdatedAt.After(request.TaskUpdatedAt.Add(time.Second)) {
		return nil, errors.New("change request conflict: task was updated after this request was created")
	}

	updateInput, err := updateTaskInputFromPayload(request.PayloadJSON)
	if err != nil {
		return nil, err
	}

	updatedTask, err := uc.taskUsecase.Update(ctx, reviewerID, globalRole, request.TaskID, updateInput)
	if err != nil {
		return nil, err
	}

	if err := uc.markReviewed(ctx, request, reviewerID, domain.TaskChangeRequestStatusApproved, input.ReviewNote); err != nil {
		return nil, err
	}
	uc.recordActivity(ctx, reviewerID, domain.ActivityTypeChangeRequestApproved, "Đã duyệt yêu cầu thay đổi công việc.", request, currentTask, map[string]interface{}{
		"change_request_id": request.ID,
		"review_note":       request.ReviewNote,
	})

	notifications, err := uc.createRequesterReviewNotification(ctx, request, updatedTask, domain.NotificationTypeTaskChangeRequestApproved)
	if err != nil {
		return nil, err
	}

	return &ReviewTaskChangeRequestResult{
		Request:       uc.toTaskChangeRequestOutput(ctx, request),
		Task:          updatedTask,
		Notifications: notifications,
	}, nil
}

func (uc *TaskChangeRequestUsecase) Reject(
	ctx context.Context,
	reviewerID uint,
	globalRole string,
	requestID uint,
	input ReviewTaskChangeRequestInput,
) (*ReviewTaskChangeRequestResult, error) {
	request, err := uc.getPendingRequest(ctx, requestID)
	if err != nil {
		return nil, err
	}

	if err := uc.accessService.CanManageProject(ctx, request.ProjectID, reviewerID, globalRole); err != nil {
		return nil, err
	}

	task, err := uc.taskRepo.GetByID(ctx, request.TaskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}

	if err := uc.markReviewed(ctx, request, reviewerID, domain.TaskChangeRequestStatusRejected, input.ReviewNote); err != nil {
		return nil, err
	}
	uc.recordActivity(ctx, reviewerID, domain.ActivityTypeChangeRequestRejected, "Đã từ chối yêu cầu thay đổi công việc.", request, task, map[string]interface{}{
		"change_request_id": request.ID,
		"review_note":       request.ReviewNote,
	})

	taskOutput := toTaskOutput(task)
	notifications, err := uc.createRequesterReviewNotification(ctx, request, taskOutput, domain.NotificationTypeTaskChangeRequestRejected)
	if err != nil {
		return nil, err
	}

	return &ReviewTaskChangeRequestResult{
		Request:       uc.toTaskChangeRequestOutput(ctx, request),
		Task:          taskOutput,
		Notifications: notifications,
	}, nil
}

func (uc *TaskChangeRequestUsecase) Cancel(
	ctx context.Context,
	actorID uint,
	globalRole string,
	requestID uint,
) (*ReviewTaskChangeRequestResult, error) {
	request, err := uc.getPendingRequest(ctx, requestID)
	if err != nil {
		return nil, err
	}

	if request.RequestedBy != actorID {
		if err := uc.accessService.CanManageProject(ctx, request.ProjectID, actorID, globalRole); err != nil {
			return nil, errors.New("forbidden: only requester or project manager can cancel this change request")
		}
	}

	task, err := uc.taskRepo.GetByID(ctx, request.TaskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}

	if err := uc.markReviewed(ctx, request, actorID, domain.TaskChangeRequestStatusCanceled, ""); err != nil {
		return nil, err
	}
	uc.recordActivity(ctx, actorID, domain.ActivityTypeChangeRequestCanceled, "Đã hủy yêu cầu thay đổi công việc.", request, task, map[string]interface{}{
		"change_request_id": request.ID,
	})

	notifications, err := uc.createManagerCancelNotifications(ctx, request, task, actorID)
	if err != nil {
		return nil, err
	}

	return &ReviewTaskChangeRequestResult{
		Request:       uc.toTaskChangeRequestOutput(ctx, request),
		Task:          toTaskOutput(task),
		Notifications: notifications,
	}, nil
}

func (uc *TaskChangeRequestUsecase) buildRequestedChanges(
	ctx context.Context,
	task *domain.Task,
	input CreateTaskChangeRequestInput,
) (map[string]interface{}, error) {
	payload := map[string]interface{}{}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return nil, errors.New("task title cannot be empty")
		}
		if title != task.Title {
			payload["title"] = title
		}
	}

	if input.Description != nil {
		description := strings.TrimSpace(*input.Description)
		if description != task.Description {
			payload["description"] = description
		}
	}

	if input.Status != nil {
		status := normalizeTaskStatus(*input.Status)
		if !isValidTaskStatus(status) {
			return nil, errors.New("invalid task status")
		}
		if status != task.Status {
			payload["status"] = status
		}
	}

	if input.Priority != nil {
		priority := normalizeTaskPriority(*input.Priority)
		if !isValidTaskPriority(priority) {
			return nil, errors.New("invalid task priority")
		}
		if priority != task.Priority {
			payload["priority"] = priority
		}
	}

	if input.AssigneeIDs.Set {
		assigneeIDs := normalizeAssigneeIDs(input.AssigneeIDs.Values)
		if err := uc.validateAssignees(ctx, task.ProjectID, assigneeIDs); err != nil {
			return nil, err
		}
		if !reflect.DeepEqual(assigneeIDs, normalizeAssigneeIDs(task.AssigneeIDs)) {
			payload["assignee_ids"] = assigneeIDs
		}
	}

	if input.Deadline.Set {
		if !sameTimePointer(input.Deadline.Value, task.Deadline) {
			if input.Deadline.Value == nil {
				payload["deadline"] = nil
			} else {
				payload["deadline"] = input.Deadline.Value.UTC()
			}
		}
	}

	if input.ReminderAt.Set {
		nextDeadline := task.Deadline
		if input.Deadline.Set {
			nextDeadline = input.Deadline.Value
		}
		if err := validateReminder(nextDeadline, input.ReminderAt.Value); err != nil {
			return nil, err
		}
		if !sameTimePointer(input.ReminderAt.Value, task.ReminderAt) {
			if input.ReminderAt.Value == nil {
				payload["reminder_at"] = nil
			} else {
				payload["reminder_at"] = input.ReminderAt.Value.UTC()
			}
		}
	}

	return payload, nil
}

func (uc *TaskChangeRequestUsecase) validateAssignees(ctx context.Context, projectID uint, userIDs []uint) error {
	for _, userID := range userIDs {
		user, err := uc.userRepo.GetByID(ctx, userID)
		if err != nil {
			return err
		}
		if user == nil {
			return errors.New("assignee not found")
		}

		member, err := uc.projectRepo.GetMember(ctx, projectID, userID)
		if err != nil {
			return err
		}
		if member == nil {
			return errors.New("assignee must be a member of this project")
		}
	}

	return nil
}

func (uc *TaskChangeRequestUsecase) getPendingRequest(ctx context.Context, requestID uint) (*domain.TaskChangeRequest, error) {
	request, err := uc.changeRequestRepo.GetByID(ctx, requestID)
	if err != nil {
		return nil, err
	}
	if request == nil {
		return nil, errors.New("change request not found")
	}
	if request.Status != domain.TaskChangeRequestStatusPending {
		return nil, errors.New("change request was already reviewed")
	}

	return request, nil
}

func (uc *TaskChangeRequestUsecase) markReviewed(
	ctx context.Context,
	request *domain.TaskChangeRequest,
	reviewerID uint,
	status string,
	reviewNote string,
) error {
	now := time.Now().UTC()
	request.Status = status
	request.ReviewedBy = &reviewerID
	request.ReviewedAt = &now
	request.ReviewNote = strings.TrimSpace(reviewNote)

	if err := uc.changeRequestRepo.UpdateReview(ctx, request); err != nil {
		return err
	}

	uc.invalidateChangeRequestCaches(ctx, request.ID, request.ProjectID, request.TaskID, request.RequestedBy)
	uc.invalidateNotificationCaches(ctx, request.RequestedBy)
	uc.invalidateNotificationCaches(ctx, reviewerID)

	if managers, err := uc.projectRepo.ListManagers(ctx, request.ProjectID); err == nil {
		for _, manager := range managers {
			uc.invalidateNotificationCaches(ctx, manager.UserID)
		}
	}

	return nil
}

func (uc *TaskChangeRequestUsecase) createManagerNotifications(
	ctx context.Context,
	request *domain.TaskChangeRequest,
	task *domain.Task,
	requester *UserReferenceOutput,
) ([]NotificationOutput, error) {
	managers, err := uc.projectRepo.ListManagers(ctx, request.ProjectID)
	if err != nil {
		return nil, err
	}

	recipients := make([]uint, 0, len(managers))
	seen := make(map[uint]struct{}, len(managers))
	for _, manager := range managers {
		if manager.UserID == request.RequestedBy {
			continue
		}
		if _, ok := seen[manager.UserID]; ok {
			continue
		}
		seen[manager.UserID] = struct{}{}
		recipients = append(recipients, manager.UserID)
	}

	notifications := make([]NotificationOutput, 0, len(recipients))
	for _, userID := range recipients {
		actorID := request.RequestedBy
		notification := &domain.Notification{
			UserID:  userID,
			ActorID: &actorID,
			Type:    domain.NotificationTypeTaskChangeRequest,
			Title:   "Yêu cầu thay đổi công việc",
			Message: fmt.Sprintf("%s muốn thay đổi task \"%s\".", requester.Name, task.Title),
			PayloadJSON: encodePayload(map[string]interface{}{
				"change_request_id":     request.ID,
				"change_request_status": request.Status,
				"task_id":               request.TaskID,
				"project_id":            request.ProjectID,
				"task_title":            task.Title,
				"requester_id":          request.RequestedBy,
				"requester_name":        requester.Name,
				"requested_changes":     decodePayload(request.PayloadJSON),
				"reason":                request.Reason,
				"task_updated_at":       request.TaskUpdatedAt,
			}),
		}

		if err := uc.notificationRepo.Create(ctx, notification); err != nil {
			return nil, err
		}

		uc.invalidateNotificationCaches(ctx, userID)
		notifications = append(notifications, *toNotificationOutputWithoutEnrichment(notification))
	}

	return notifications, nil
}

func (uc *TaskChangeRequestUsecase) createManagerCancelNotifications(
	ctx context.Context,
	request *domain.TaskChangeRequest,
	task *domain.Task,
	actorID uint,
) ([]NotificationOutput, error) {
	managers, err := uc.projectRepo.ListManagers(ctx, request.ProjectID)
	if err != nil {
		return nil, err
	}

	requester := uc.userReference(ctx, request.RequestedBy)
	notifications := make([]NotificationOutput, 0, len(managers))
	seen := make(map[uint]struct{}, len(managers))
	for _, manager := range managers {
		if manager.UserID == actorID {
			continue
		}
		if _, ok := seen[manager.UserID]; ok {
			continue
		}
		seen[manager.UserID] = struct{}{}

		notification := &domain.Notification{
			UserID:  manager.UserID,
			ActorID: &actorID,
			Type:    domain.NotificationTypeTaskChangeRequest,
			Title:   "Yêu cầu thay đổi đã hủy",
			Message: fmt.Sprintf("%s đã hủy yêu cầu thay đổi task \"%s\".", requester.Name, task.Title),
			PayloadJSON: encodePayload(map[string]interface{}{
				"change_request_id":     request.ID,
				"change_request_status": request.Status,
				"task_id":               request.TaskID,
				"project_id":            request.ProjectID,
				"task_title":            task.Title,
				"requester_id":          request.RequestedBy,
				"requester_name":        requester.Name,
				"requested_changes":     decodePayload(request.PayloadJSON),
				"reason":                request.Reason,
			}),
		}

		if err := uc.notificationRepo.Create(ctx, notification); err != nil {
			return nil, err
		}

		uc.invalidateNotificationCaches(ctx, manager.UserID)
		notifications = append(notifications, *toNotificationOutputWithoutEnrichment(notification))
	}

	return notifications, nil
}

func (uc *TaskChangeRequestUsecase) createRequesterPendingNotification(
	ctx context.Context,
	request *domain.TaskChangeRequest,
	task *domain.Task,
) ([]NotificationOutput, error) {
	actorID := request.RequestedBy
	notification := &domain.Notification{
		UserID:  request.RequestedBy,
		ActorID: &actorID,
		Type:    domain.NotificationTypeTaskChangeRequest,
		Title:   "Yêu cầu thay đổi đang chờ duyệt",
		Message: fmt.Sprintf("Yêu cầu thay đổi task \"%s\" đã được gửi đến owner/admin.", task.Title),
		PayloadJSON: encodePayload(map[string]interface{}{
			"change_request_id":     request.ID,
			"change_request_status": request.Status,
			"task_id":               request.TaskID,
			"project_id":            request.ProjectID,
			"task_title":            task.Title,
			"requester_id":          request.RequestedBy,
			"requested_changes":     decodePayload(request.PayloadJSON),
			"reason":                request.Reason,
			"task_updated_at":       request.TaskUpdatedAt,
		}),
	}

	if err := uc.notificationRepo.Create(ctx, notification); err != nil {
		return nil, err
	}

	uc.invalidateNotificationCaches(ctx, request.RequestedBy)
	return []NotificationOutput{*toNotificationOutputWithoutEnrichment(notification)}, nil
}

func (uc *TaskChangeRequestUsecase) createRequesterReviewNotification(
	ctx context.Context,
	request *domain.TaskChangeRequest,
	task *TaskOutput,
	notificationType string,
) ([]NotificationOutput, error) {
	actorID := uint(0)
	if request.ReviewedBy != nil {
		actorID = *request.ReviewedBy
	}

	title := "Yêu cầu thay đổi đã được duyệt"
	message := fmt.Sprintf("Yêu cầu thay đổi task \"%s\" đã được duyệt.", task.Title)
	if notificationType == domain.NotificationTypeTaskChangeRequestRejected {
		title = "Yêu cầu thay đổi bị từ chối"
		message = fmt.Sprintf("Yêu cầu thay đổi task \"%s\" đã bị từ chối.", task.Title)
	}

	notification := &domain.Notification{
		UserID:  request.RequestedBy,
		ActorID: &actorID,
		Type:    notificationType,
		Title:   title,
		Message: message,
		PayloadJSON: encodePayload(map[string]interface{}{
			"change_request_id":     request.ID,
			"change_request_status": request.Status,
			"task_id":               request.TaskID,
			"project_id":            request.ProjectID,
			"task_title":            task.Title,
			"requested_changes":     decodePayload(request.PayloadJSON),
			"review_note":           request.ReviewNote,
		}),
	}

	if request.ReviewedBy != nil && *request.ReviewedBy == request.RequestedBy {
		return []NotificationOutput{}, nil
	}

	if err := uc.notificationRepo.Create(ctx, notification); err != nil {
		return nil, err
	}

	uc.invalidateNotificationCaches(ctx, request.RequestedBy)

	return []NotificationOutput{*toNotificationOutputWithoutEnrichment(notification)}, nil
}

func (uc *TaskChangeRequestUsecase) userReference(ctx context.Context, userID uint) *UserReferenceOutput {
	user, err := uc.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return &UserReferenceOutput{
			ID:   userID,
			Name: fmt.Sprintf("User #%d", userID),
		}
	}

	return &UserReferenceOutput{
		ID:    user.ID,
		Name:  user.Name,
		Email: user.Email,
	}
}

func (uc *TaskChangeRequestUsecase) canManageProject(ctx context.Context, actorID uint, globalRole string, projectID uint) bool {
	return uc.accessService.CanManageProject(ctx, projectID, actorID, globalRole) == nil
}

func (uc *TaskChangeRequestUsecase) canViewRequest(
	ctx context.Context,
	actorID uint,
	globalRole string,
	request *domain.TaskChangeRequest,
) error {
	if err := uc.accessService.CanViewProject(ctx, request.ProjectID, actorID, globalRole); err != nil {
		return err
	}

	if request.RequestedBy == actorID || uc.canManageProject(ctx, actorID, globalRole, request.ProjectID) {
		return nil
	}

	return errors.New("forbidden: you can only view your own change requests")
}

func (uc *TaskChangeRequestUsecase) toTaskChangeRequestOutput(ctx context.Context, request *domain.TaskChangeRequest) *TaskChangeRequestOutput {
	var task *domain.Task
	if request.TaskID != 0 {
		task, _ = uc.taskRepo.GetByID(ctx, request.TaskID)
	}

	return uc.toTaskChangeRequestOutputWithTask(ctx, request, task)
}

func (uc *TaskChangeRequestUsecase) toTaskChangeRequestOutputWithTask(
	ctx context.Context,
	request *domain.TaskChangeRequest,
	task *domain.Task,
) *TaskChangeRequestOutput {
	payload := decodePayload(request.PayloadJSON)

	return &TaskChangeRequestOutput{
		ID:            request.ID,
		TaskID:        request.TaskID,
		ProjectID:     request.ProjectID,
		RequestedBy:   request.RequestedBy,
		Requester:     uc.userReference(ctx, request.RequestedBy),
		Payload:       payload,
		CurrentValues: currentValuesForRequest(task, payload),
		Reason:        request.Reason,
		TaskUpdatedAt: request.TaskUpdatedAt,
		Conflict:      changeRequestHasConflict(task, request),
		Status:        request.Status,
		ReviewedBy:    request.ReviewedBy,
		ReviewedAt:    request.ReviewedAt,
		ReviewNote:    request.ReviewNote,
		CreatedAt:     request.CreatedAt,
		UpdatedAt:     request.UpdatedAt,
	}
}

func currentValuesForRequest(task *domain.Task, payload map[string]interface{}) map[string]interface{} {
	current := map[string]interface{}{}
	if task == nil {
		return current
	}

	for key := range payload {
		switch key {
		case "title":
			current[key] = task.Title
		case "description":
			current[key] = task.Description
		case "status":
			current[key] = task.Status
		case "priority":
			current[key] = task.Priority
		case "assignee_ids":
			current[key] = assigneeIDsFromTask(task)
		case "deadline":
			current[key] = task.Deadline
		case "reminder_at":
			current[key] = task.ReminderAt
		}
	}

	return current
}

func assigneeIDsFromTask(task *domain.Task) []uint {
	assigneeIDs := normalizeAssigneeIDs(task.AssigneeIDs)
	if len(assigneeIDs) == 0 && task.AssigneeID != nil {
		assigneeIDs = []uint{*task.AssigneeID}
	}

	return assigneeIDs
}

func changeRequestHasConflict(task *domain.Task, request *domain.TaskChangeRequest) bool {
	return task != nil &&
		request != nil &&
		request.Status == domain.TaskChangeRequestStatusPending &&
		request.TaskUpdatedAt != nil &&
		task.UpdatedAt.After(request.TaskUpdatedAt.Add(time.Second))
}

func (uc *TaskChangeRequestUsecase) recordActivity(
	ctx context.Context,
	actorID uint,
	activityType string,
	message string,
	request *domain.TaskChangeRequest,
	task *domain.Task,
	payload map[string]interface{},
) {
	if uc.activity == nil || request == nil {
		return
	}

	taskID := request.TaskID
	if task != nil {
		taskID = task.ID
	}
	actor := actorID
	_, _ = uc.activity.Record(ctx, RecordActivityInput{
		ProjectID: request.ProjectID,
		TaskID:    &taskID,
		ActorID:   &actor,
		Type:      activityType,
		Message:   message,
		Payload:   payload,
	})
}

func (uc *TaskChangeRequestUsecase) invalidateChangeRequestCaches(ctx context.Context, requestID uint, projectID uint, taskID uint, requesterID uint) {
	deleteCacheKeys(ctx, uc.cacheService, fmt.Sprintf("change-request:%d:detail", requestID))
	deleteCachePatterns(ctx, uc.cacheService,
		fmt.Sprintf("project:%d:change-requests:*", projectID),
		fmt.Sprintf("task:%d:change-requests:*", taskID),
		fmt.Sprintf("user:%d:change-requests:*", requesterID),
	)
}

func (uc *TaskChangeRequestUsecase) invalidateNotificationCaches(ctx context.Context, userID uint) {
	deleteCachePatterns(ctx, uc.cacheService, fmt.Sprintf("user:%d:notifications:*", userID))
}

func updateTaskInputFromPayload(raw string) (UpdateTaskInput, error) {
	payload := decodePayload(raw)
	input := UpdateTaskInput{}

	if value, ok := payload["title"]; ok {
		title, ok := value.(string)
		if !ok {
			return input, errors.New("invalid requested title")
		}
		input.Title = &title
	}

	if value, ok := payload["description"]; ok {
		description, ok := value.(string)
		if !ok {
			return input, errors.New("invalid requested description")
		}
		input.Description = &description
	}

	if value, ok := payload["status"]; ok {
		status, ok := value.(string)
		if !ok {
			return input, errors.New("invalid requested status")
		}
		input.Status = &status
	}

	if value, ok := payload["priority"]; ok {
		priority, ok := value.(string)
		if !ok {
			return input, errors.New("invalid requested priority")
		}
		input.Priority = &priority
	}

	if value, ok := payload["assignee_ids"]; ok {
		assigneeIDs, err := uintSliceFromPayload(value)
		if err != nil {
			return input, err
		}
		input.AssigneeIDs = OptionalUintSliceInput{
			Set:    true,
			Values: assigneeIDs,
		}
	}

	if value, ok := payload["deadline"]; ok {
		input.Deadline.Set = true
		if value == nil {
			input.Deadline.Value = nil
		} else {
			deadline, err := timeFromPayload(value)
			if err != nil {
				return input, err
			}
			input.Deadline.Value = &deadline
		}
	}

	if value, ok := payload["reminder_at"]; ok {
		input.ReminderAt.Set = true
		if value == nil {
			input.ReminderAt.Value = nil
		} else {
			reminderAt, err := timeFromPayload(value)
			if err != nil {
				return input, err
			}
			input.ReminderAt.Value = &reminderAt
		}
	}

	return input, nil
}

func uintSliceFromPayload(value interface{}) ([]uint, error) {
	rawItems, ok := value.([]interface{})
	if !ok {
		return nil, errors.New("invalid requested assignees")
	}

	result := make([]uint, 0, len(rawItems))
	for _, rawItem := range rawItems {
		switch item := rawItem.(type) {
		case float64:
			if item > 0 {
				result = append(result, uint(item))
			}
		case int:
			if item > 0 {
				result = append(result, uint(item))
			}
		default:
			return nil, errors.New("invalid requested assignee")
		}
	}

	return result, nil
}

func timeFromPayload(value interface{}) (time.Time, error) {
	switch item := value.(type) {
	case string:
		parsed, err := time.Parse(time.RFC3339, item)
		if err == nil {
			return parsed, nil
		}
		parsed, err = time.Parse(time.RFC3339Nano, item)
		if err == nil {
			return parsed, nil
		}
	}

	return time.Time{}, errors.New("invalid requested deadline")
}

func sameTimePointer(left *time.Time, right *time.Time) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}

	return left.UTC().Equal(right.UTC())
}

func toNotificationOutputWithoutEnrichment(notification *domain.Notification) *NotificationOutput {
	return &NotificationOutput{
		ID:        notification.ID,
		UserID:    notification.UserID,
		ActorID:   notification.ActorID,
		Type:      notification.Type,
		Title:     notification.Title,
		Message:   notification.Message,
		Payload:   decodePayload(notification.PayloadJSON),
		ReadAt:    notification.ReadAt,
		CreatedAt: notification.CreatedAt,
		UpdatedAt: notification.UpdatedAt,
	}
}
