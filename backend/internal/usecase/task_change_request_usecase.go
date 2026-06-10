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
}

type CreateTaskChangeRequestInput struct {
	Title       *string
	Description *string
	Status      *string
	AssigneeIDs OptionalUintSliceInput
	Deadline    OptionalTimeInput
	Reason      string
}

type ReviewTaskChangeRequestInput struct {
	Decision string
}

type TaskChangeRequestOutput struct {
	ID          uint                   `json:"id"`
	TaskID      uint                   `json:"task_id"`
	ProjectID   uint                   `json:"project_id"`
	RequestedBy uint                   `json:"requested_by"`
	Requester   *UserReferenceOutput   `json:"requester,omitempty"`
	Payload     map[string]interface{} `json:"payload"`
	Reason      string                 `json:"reason"`
	Status      string                 `json:"status"`
	ReviewedBy  *uint                  `json:"reviewed_by"`
	ReviewedAt  *time.Time             `json:"reviewed_at"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
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

	payload, err := uc.buildRequestedChanges(ctx, task, input)
	if err != nil {
		return nil, err
	}
	if len(payload) == 0 {
		return nil, errors.New("change request must include at least one change")
	}

	request := &domain.TaskChangeRequest{
		TaskID:      task.ID,
		ProjectID:   task.ProjectID,
		RequestedBy: actorID,
		PayloadJSON: encodePayload(payload),
		Reason:      strings.TrimSpace(input.Reason),
		Status:      domain.TaskChangeRequestStatusPending,
	}

	if err := uc.changeRequestRepo.Create(ctx, request); err != nil {
		return nil, err
	}

	requester := uc.userReference(ctx, actorID)
	notifications, err := uc.createManagerNotifications(ctx, request, task, requester)
	if err != nil {
		return nil, err
	}

	uc.invalidateChangeRequestCaches(ctx, request.ID, request.ProjectID, actorID)

	return &CreateTaskChangeRequestResult{
		Request:       uc.toTaskChangeRequestOutput(ctx, request),
		Notifications: notifications,
	}, nil
}

func (uc *TaskChangeRequestUsecase) Approve(
	ctx context.Context,
	reviewerID uint,
	globalRole string,
	requestID uint,
) (*ReviewTaskChangeRequestResult, error) {
	request, err := uc.getPendingRequest(ctx, requestID)
	if err != nil {
		return nil, err
	}

	if err := uc.accessService.CanManageProject(ctx, request.ProjectID, reviewerID, globalRole); err != nil {
		return nil, err
	}

	updateInput, err := updateTaskInputFromPayload(request.PayloadJSON)
	if err != nil {
		return nil, err
	}

	updatedTask, err := uc.taskUsecase.Update(ctx, reviewerID, globalRole, request.TaskID, updateInput)
	if err != nil {
		return nil, err
	}

	if err := uc.markReviewed(ctx, request, reviewerID, domain.TaskChangeRequestStatusApproved); err != nil {
		return nil, err
	}

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

	if err := uc.markReviewed(ctx, request, reviewerID, domain.TaskChangeRequestStatusRejected); err != nil {
		return nil, err
	}

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
) error {
	now := time.Now().UTC()
	request.Status = status
	request.ReviewedBy = &reviewerID
	request.ReviewedAt = &now

	if err := uc.changeRequestRepo.UpdateReview(ctx, request); err != nil {
		return err
	}

	uc.invalidateChangeRequestCaches(ctx, request.ID, request.ProjectID, request.RequestedBy)
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

func (uc *TaskChangeRequestUsecase) toTaskChangeRequestOutput(ctx context.Context, request *domain.TaskChangeRequest) *TaskChangeRequestOutput {
	return &TaskChangeRequestOutput{
		ID:          request.ID,
		TaskID:      request.TaskID,
		ProjectID:   request.ProjectID,
		RequestedBy: request.RequestedBy,
		Requester:   uc.userReference(ctx, request.RequestedBy),
		Payload:     decodePayload(request.PayloadJSON),
		Reason:      request.Reason,
		Status:      request.Status,
		ReviewedBy:  request.ReviewedBy,
		ReviewedAt:  request.ReviewedAt,
		CreatedAt:   request.CreatedAt,
		UpdatedAt:   request.UpdatedAt,
	}
}

func (uc *TaskChangeRequestUsecase) invalidateChangeRequestCaches(ctx context.Context, requestID uint, projectID uint, requesterID uint) {
	deleteCacheKeys(ctx, uc.cacheService, fmt.Sprintf("change-request:%d:detail", requestID))
	deleteCachePatterns(ctx, uc.cacheService,
		fmt.Sprintf("project:%d:change-requests:*", projectID),
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
