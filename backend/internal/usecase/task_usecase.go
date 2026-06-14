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

type TaskUsecase struct {
	taskRepo      interfaces.TaskRepository
	projectRepo   interfaces.ProjectRepository
	userRepo      interfaces.UserRepository
	accessService *AccessService
	cacheService  interfaces.CacheService
	activity      *ActivityUsecase
}

type CreateTaskInput struct {
	Title       string
	Description string
	Priority    string
	AssigneeID  *uint
	AssigneeIDs []uint
	Deadline    *time.Time
	ReminderAt  *time.Time
}

type OptionalTimeInput struct {
	Set   bool
	Value *time.Time
}

type UpdateTaskInput struct {
	Title       *string
	Description *string
	Status      *string
	Priority    *string
	AssigneeID  *uint
	AssigneeIDs OptionalUintSliceInput
	Deadline    OptionalTimeInput
	ReminderAt  OptionalTimeInput
}

type OptionalUintSliceInput struct {
	Set    bool
	Values []uint
}

type TaskOutput struct {
	ID          uint       `json:"id"`
	ProjectID   uint       `json:"project_id"`
	ProjectName string     `json:"project_name,omitempty"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Progress    int        `json:"progress"`
	Priority    string     `json:"priority"`
	AssigneeID  *uint      `json:"assignee_id"`
	Assignees   []uint     `json:"assignee_ids"`
	Deadline    *time.Time `json:"deadline"`
	ReminderAt  *time.Time `json:"reminder_at"`
	ArchivedAt  *time.Time `json:"archived_at"`
	ArchivedBy  *uint      `json:"archived_by"`
	DeletedAt   *time.Time `json:"deleted_at,omitempty"`
	DeletedBy   *uint      `json:"deleted_by,omitempty"`
	CreatedBy   uint       `json:"created_by"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type ListTasksByProjectInput struct {
	ArchiveFilter string
	Page          int
	PageSize      int
}

type ListMyTasksInput struct {
	ProjectID *uint
	Status    string
	Page      int
	PageSize  int
}

type taskListCacheEntry struct {
	Data  []TaskOutput `json:"data"`
	Total int64        `json:"total"`
}

func NewTaskUsecase(
	taskRepo interfaces.TaskRepository,
	projectRepo interfaces.ProjectRepository,
	userRepo interfaces.UserRepository,
	accessService *AccessService,
	cacheService interfaces.CacheService,
) *TaskUsecase {
	return &TaskUsecase{
		taskRepo:      taskRepo,
		projectRepo:   projectRepo,
		userRepo:      userRepo,
		accessService: accessService,
		cacheService:  cacheService,
	}
}

func (uc *TaskUsecase) SetActivityUsecase(activity *ActivityUsecase) {
	uc.activity = activity
}

func (uc *TaskUsecase) Create(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
	input CreateTaskInput,
) (*TaskOutput, error) {
	project, err := uc.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, errors.New("project not found")
	}

	if err := uc.accessService.CanManageProject(ctx, projectID, actorID, globalRole); err != nil {
		return nil, err
	}

	title := strings.TrimSpace(input.Title)
	description := strings.TrimSpace(input.Description)

	if title == "" {
		return nil, errors.New("task title is required")
	}
	priority := normalizeTaskPriority(input.Priority)
	if !isValidTaskPriority(priority) {
		return nil, errors.New("invalid task priority")
	}
	if err := validateReminder(input.Deadline, input.ReminderAt); err != nil {
		return nil, err
	}

	assigneeIDs := normalizeAssigneeIDs(input.AssigneeIDs)
	if len(assigneeIDs) == 0 && input.AssigneeID != nil {
		assigneeIDs = normalizeAssigneeIDs([]uint{*input.AssigneeID})
	}
	if err := uc.validateAssignees(ctx, projectID, assigneeIDs); err != nil {
		return nil, err
	}

	var primaryAssigneeID *uint
	if len(assigneeIDs) > 0 {
		primaryAssigneeID = &assigneeIDs[0]
	}

	task := &domain.Task{
		ProjectID:   projectID,
		Title:       title,
		Description: description,
		Status:      domain.TaskStatusTodo,
		Progress:    0,
		Priority:    priority,
		AssigneeID:  primaryAssigneeID,
		AssigneeIDs: assigneeIDs,
		Deadline:    input.Deadline,
		ReminderAt:  input.ReminderAt,
		CreatedBy:   actorID,
	}

	if err := uc.taskRepo.Create(ctx, task); err != nil {
		return nil, err
	}

	uc.invalidateTaskCaches(ctx, task.ID, task.ProjectID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskCreated, fmt.Sprintf("Đã tạo task \"%s\".", task.Title), task, map[string]interface{}{
		"title":        task.Title,
		"assignee_ids": task.AssigneeIDs,
		"deadline":     task.Deadline,
		"reminder_at":  task.ReminderAt,
		"priority":     task.Priority,
	})

	return toTaskOutput(task), nil
}

func (uc *TaskUsecase) ListByProject(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
	input ListTasksByProjectInput,
) ([]TaskOutput, int64, error) {
	project, err := uc.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, 0, err
	}
	if project == nil {
		return nil, 0, errors.New("project not found")
	}

	if err := uc.accessService.CanViewProject(ctx, projectID, actorID, globalRole); err != nil {
		return nil, 0, err
	}

	page, pageSize := normalizePagination(input.Page, input.PageSize)
	archiveFilter := normalizeArchiveFilter(input.ArchiveFilter)
	cacheKey := fmt.Sprintf("project:%d:tasks:archive:%s:page:%d:size:%d", projectID, archiveFilter, page, pageSize)

	var cached taskListCacheEntry
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached.Data, cached.Total, nil
	}

	tasks, total, err := uc.taskRepo.ListByProject(ctx, projectID, archiveFilter, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	result := make([]TaskOutput, 0, len(tasks))
	for _, task := range tasks {
		result = append(result, *toTaskOutput(task))
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, taskListCacheEntry{
		Data:  result,
		Total: total,
	}, readCacheTTL)

	return result, total, nil
}

func (uc *TaskUsecase) Archive(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
) (*TaskOutput, error) {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}

	if err := uc.accessService.CanManageProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
		return nil, err
	}

	if task.ArchivedAt == nil {
		if err := uc.taskRepo.Archive(ctx, taskID, actorID); err != nil {
			return nil, err
		}
		uc.invalidateTaskCaches(ctx, taskID, task.ProjectID)
		uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskArchived, fmt.Sprintf("Đã lưu trữ task \"%s\".", task.Title), task, map[string]interface{}{
			"title": task.Title,
		})
	}

	refreshed, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if refreshed == nil {
		return nil, errors.New("task not found")
	}

	return toTaskOutput(refreshed), nil
}

func (uc *TaskUsecase) Restore(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
) (*TaskOutput, error) {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}

	if err := uc.accessService.CanManageProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
		return nil, err
	}

	if task.ArchivedAt != nil {
		if err := uc.taskRepo.Restore(ctx, taskID); err != nil {
			return nil, err
		}
		uc.invalidateTaskCaches(ctx, taskID, task.ProjectID)
		uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskRestored, fmt.Sprintf("Đã khôi phục task \"%s\".", task.Title), task, map[string]interface{}{
			"title": task.Title,
		})
	}

	refreshed, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if refreshed == nil {
		return nil, errors.New("task not found")
	}

	return toTaskOutput(refreshed), nil
}

func (uc *TaskUsecase) ListAssignedToUser(
	ctx context.Context,
	actorID uint,
	globalRole string,
	input ListMyTasksInput,
) ([]TaskOutput, int64, error) {
	page, pageSize := normalizePagination(input.Page, input.PageSize)

	status := strings.TrimSpace(input.Status)
	if status != "" {
		status = normalizeTaskStatus(status)
		if !isValidTaskStatus(status) {
			return nil, 0, errors.New("invalid task status")
		}
	}

	if input.ProjectID != nil {
		project, err := uc.projectRepo.GetByID(ctx, *input.ProjectID)
		if err != nil {
			return nil, 0, err
		}
		if project == nil {
			return nil, 0, errors.New("project not found")
		}

		if err := uc.accessService.CanViewProject(ctx, *input.ProjectID, actorID, globalRole); err != nil {
			return nil, 0, err
		}
	}

	projectKey := "all"
	if input.ProjectID != nil {
		projectKey = fmt.Sprintf("%d", *input.ProjectID)
	}
	cacheKey := fmt.Sprintf("user:%d:tasks:role:%s:project:%s:status:%s:page:%d:size:%d", actorID, globalRole, projectKey, status, page, pageSize)

	var cached taskListCacheEntry
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached.Data, cached.Total, nil
	}

	requireMembership := globalRole != domain.UserRoleAdmin
	tasks, total, err := uc.taskRepo.ListAssignedToUser(
		ctx,
		actorID,
		input.ProjectID,
		status,
		requireMembership,
		page,
		pageSize,
	)
	if err != nil {
		return nil, 0, err
	}

	projectNames := make(map[uint]string)
	result := make([]TaskOutput, 0, len(tasks))
	for _, task := range tasks {
		output := *toTaskOutput(task)

		projectName, ok := projectNames[task.ProjectID]
		if !ok {
			project, err := uc.projectRepo.GetByID(ctx, task.ProjectID)
			if err != nil {
				return nil, 0, err
			}
			if project != nil {
				projectName = project.Name
			}
			projectNames[task.ProjectID] = projectName
		}

		output.ProjectName = projectName
		result = append(result, output)
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, taskListCacheEntry{
		Data:  result,
		Total: total,
	}, readCacheTTL)

	return result, total, nil
}

func (uc *TaskUsecase) GetByID(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
) (*TaskOutput, error) {
	cacheKey := fmt.Sprintf("task:%d:detail", taskID)
	var cached TaskOutput
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		if err := uc.accessService.CanViewProject(ctx, cached.ProjectID, actorID, globalRole); err != nil {
			return nil, err
		}
		return &cached, nil
	}

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

	output := toTaskOutput(task)
	setCachedJSON(ctx, uc.cacheService, cacheKey, output, readCacheTTL)

	return output, nil
}

func (uc *TaskUsecase) Update(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
	input UpdateTaskInput,
) (*TaskOutput, error) {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}
	previous := cloneTaskForActivity(task)

	role, err := uc.accessService.GetProjectRole(ctx, task.ProjectID, actorID, globalRole)
	if err != nil {
		return nil, err
	}

	isSystemAdmin := globalRole == domain.UserRoleAdmin
	isProjectManager := role == domain.ProjectRoleOwner || role == domain.ProjectRoleAdmin

	if !isSystemAdmin && !isProjectManager {
		if !taskHasAssignee(task, actorID) {
			return nil, errors.New("forbidden: you can only update tasks assigned to you")
		}

		if input.Title != nil || input.Description != nil || input.Priority != nil || input.AssigneeID != nil || input.AssigneeIDs.Set || input.Deadline.Set || input.ReminderAt.Set {
			return nil, errors.New("forbidden: member can only update task status")
		}

		if input.Status == nil {
			return nil, errors.New("status is required")
		}

		status := normalizeTaskStatus(*input.Status)
		if !isValidTaskStatus(status) {
			return nil, errors.New("invalid task status")
		}
		task.Status = status

		if err := uc.taskRepo.Update(ctx, task); err != nil {
			return nil, err
		}

		uc.invalidateTaskCaches(ctx, task.ID, task.ProjectID)
		uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskUpdated, "Đã cập nhật trạng thái công việc.", task, taskChangePayload(&previous, task))

		return toTaskOutput(task), nil
	}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return nil, errors.New("task title cannot be empty")
		}
		task.Title = title
	}

	if input.Description != nil {
		task.Description = strings.TrimSpace(*input.Description)
	}

	if input.Status != nil {
		status := normalizeTaskStatus(*input.Status)
		if !isValidTaskStatus(status) {
			return nil, errors.New("invalid task status")
		}
		task.Status = status
	}

	if input.Priority != nil {
		priority := normalizeTaskPriority(*input.Priority)
		if !isValidTaskPriority(priority) {
			return nil, errors.New("invalid task priority")
		}
		task.Priority = priority
	}

	if input.AssigneeID != nil {
		if err := uc.validateAssignees(ctx, task.ProjectID, []uint{*input.AssigneeID}); err != nil {
			return nil, err
		}
		task.AssigneeIDs = []uint{*input.AssigneeID}
		task.AssigneeID = input.AssigneeID
	}

	if input.AssigneeIDs.Set {
		assigneeIDs := normalizeAssigneeIDs(input.AssigneeIDs.Values)
		if err := uc.validateAssignees(ctx, task.ProjectID, assigneeIDs); err != nil {
			return nil, err
		}

		task.AssigneeIDs = assigneeIDs
		task.AssigneeID = nil
		if len(assigneeIDs) > 0 {
			task.AssigneeID = &assigneeIDs[0]
		}
	}

	if input.Deadline.Set {
		task.Deadline = input.Deadline.Value
		if task.Deadline == nil {
			task.ReminderAt = nil
		}
	}

	if input.ReminderAt.Set {
		task.ReminderAt = input.ReminderAt.Value
	}

	if err := validateReminder(task.Deadline, task.ReminderAt); err != nil {
		return nil, err
	}

	if err := uc.taskRepo.Update(ctx, task); err != nil {
		return nil, err
	}

	uc.invalidateTaskCaches(ctx, task.ID, task.ProjectID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskUpdated, "Đã cập nhật công việc.", task, taskChangePayload(&previous, task))

	return toTaskOutput(task), nil
}

func (uc *TaskUsecase) Delete(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
) error {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return err
	}
	if task == nil {
		return errors.New("task not found")
	}

	if err := uc.accessService.CanManageProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
		return err
	}

	uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskDeleted, fmt.Sprintf("Đã xóa task \"%s\".", task.Title), task, map[string]interface{}{
		"title": task.Title,
	})

	if err := uc.taskRepo.Delete(ctx, taskID, actorID); err != nil {
		return err
	}

	uc.invalidateTaskCaches(ctx, taskID, task.ProjectID)
	return nil
}

func (uc *TaskUsecase) invalidateTaskCaches(ctx context.Context, taskID uint, projectID uint) {
	deleteCacheKeys(ctx, uc.cacheService, fmt.Sprintf("task:%d:detail", taskID))
	deleteCachePatterns(ctx, uc.cacheService,
		fmt.Sprintf("task:%d:comments:*", taskID),
		fmt.Sprintf("task:%d:checklists", taskID),
		fmt.Sprintf("task:%d:activities:*", taskID),
		fmt.Sprintf("project:%d:tasks:*", projectID),
		"user:*:tasks:*",
	)
}

func (uc *TaskUsecase) recordActivity(
	ctx context.Context,
	actorID uint,
	activityType string,
	message string,
	task *domain.Task,
	payload map[string]interface{},
) {
	if uc.activity == nil || task == nil {
		return
	}

	taskID := task.ID
	actor := actorID
	_, _ = uc.activity.Record(ctx, RecordActivityInput{
		ProjectID: task.ProjectID,
		TaskID:    &taskID,
		ActorID:   &actor,
		Type:      activityType,
		Message:   message,
		Payload:   payload,
	})
}

func cloneTaskForActivity(task *domain.Task) domain.Task {
	clone := *task
	clone.AssigneeIDs = append([]uint{}, task.AssigneeIDs...)
	return clone
}

func taskChangePayload(previous *domain.Task, current *domain.Task) map[string]interface{} {
	payload := map[string]interface{}{}
	if previous == nil || current == nil {
		return payload
	}

	if previous.Title != current.Title {
		payload["title"] = map[string]interface{}{
			"from": previous.Title,
			"to":   current.Title,
		}
	}
	if previous.Description != current.Description {
		payload["description"] = map[string]interface{}{
			"from": previous.Description,
			"to":   current.Description,
		}
	}
	if previous.Status != current.Status {
		payload["status"] = map[string]interface{}{
			"from": previous.Status,
			"to":   current.Status,
		}
	}
	if !reflect.DeepEqual(normalizeAssigneeIDs(previous.AssigneeIDs), normalizeAssigneeIDs(current.AssigneeIDs)) {
		payload["assignee_ids"] = map[string]interface{}{
			"from": normalizeAssigneeIDs(previous.AssigneeIDs),
			"to":   normalizeAssigneeIDs(current.AssigneeIDs),
		}
	}
	if !sameTimePointer(previous.Deadline, current.Deadline) {
		payload["deadline"] = map[string]interface{}{
			"from": previous.Deadline,
			"to":   current.Deadline,
		}
	}
	if !sameTimePointer(previous.ReminderAt, current.ReminderAt) {
		payload["reminder_at"] = map[string]interface{}{
			"from": previous.ReminderAt,
			"to":   current.ReminderAt,
		}
	}
	if previous.Priority != current.Priority {
		payload["priority"] = map[string]interface{}{
			"from": previous.Priority,
			"to":   current.Priority,
		}
	}

	return payload
}

func toTaskOutput(task *domain.Task) *TaskOutput {
	assigneeIDs := normalizeAssigneeIDs(task.AssigneeIDs)
	if len(assigneeIDs) == 0 && task.AssigneeID != nil {
		assigneeIDs = []uint{*task.AssigneeID}
	}

	return &TaskOutput{
		ID:          task.ID,
		ProjectID:   task.ProjectID,
		Title:       task.Title,
		Description: task.Description,
		Status:      task.Status,
		Progress:    task.Progress,
		Priority:    normalizeTaskPriority(task.Priority),
		AssigneeID:  task.AssigneeID,
		Assignees:   assigneeIDs,
		Deadline:    task.Deadline,
		ReminderAt:  task.ReminderAt,
		ArchivedAt:  task.ArchivedAt,
		ArchivedBy:  task.ArchivedBy,
		DeletedAt:   task.DeletedAt,
		DeletedBy:   task.DeletedBy,
		CreatedBy:   task.CreatedBy,
		CreatedAt:   task.CreatedAt,
		UpdatedAt:   task.UpdatedAt,
	}
}

func normalizeArchiveFilter(filter string) string {
	filter = strings.ToLower(strings.TrimSpace(filter))
	switch filter {
	case domain.TaskArchiveFilterArchived, domain.TaskArchiveFilterAll:
		return filter
	default:
		return domain.TaskArchiveFilterActive
	}
}

func normalizeTaskStatus(status string) string {
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "in-progress" {
		return domain.TaskStatusInProgress
	}
	return status
}

func isValidTaskStatus(status string) bool {
	return status == domain.TaskStatusTodo ||
		status == domain.TaskStatusInProgress ||
		status == domain.TaskStatusDone
}

func normalizeTaskPriority(priority string) string {
	priority = strings.ToLower(strings.TrimSpace(priority))
	if priority == "" {
		return domain.TaskPriorityNone
	}
	return priority
}

func isValidTaskPriority(priority string) bool {
	return priority == domain.TaskPriorityNone ||
		priority == domain.TaskPriorityLow ||
		priority == domain.TaskPriorityMedium ||
		priority == domain.TaskPriorityHigh ||
		priority == domain.TaskPriorityUrgent
}

func validateReminder(deadline *time.Time, reminderAt *time.Time) error {
	if reminderAt == nil {
		return nil
	}
	if deadline == nil {
		return errors.New("deadline is required before setting reminder")
	}
	if reminderAt.After(*deadline) {
		return errors.New("reminder must be before deadline")
	}
	return nil
}

func (uc *TaskUsecase) validateAssignees(ctx context.Context, projectID uint, userIDs []uint) error {
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

func normalizeAssigneeIDs(userIDs []uint) []uint {
	seen := make(map[uint]struct{}, len(userIDs))
	result := make([]uint, 0, len(userIDs))

	for _, userID := range userIDs {
		if userID == 0 {
			continue
		}
		if _, ok := seen[userID]; ok {
			continue
		}
		seen[userID] = struct{}{}
		result = append(result, userID)
	}

	return result
}

func taskHasAssignee(task *domain.Task, userID uint) bool {
	for _, assigneeID := range task.AssigneeIDs {
		if assigneeID == userID {
			return true
		}
	}

	return task.AssigneeID != nil && *task.AssigneeID == userID
}
