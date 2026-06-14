package usecase

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

type TaskMetadataUsecase struct {
	labelRepo      interfaces.TaskLabelRepository
	attachmentRepo interfaces.TaskAttachmentRepository
	taskRepo       interfaces.TaskRepository
	accessService  *AccessService
	cacheService   interfaces.CacheService
	activity       *ActivityUsecase
}

type CreateTaskLabelInput struct {
	Name  string
	Color string
}

type UpdateTaskLabelInput struct {
	Name  *string
	Color *string
}

type CreateTaskAttachmentInput struct {
	Name string
	URL  string
}

type UpdateTaskAttachmentInput struct {
	Name *string
	URL  *string
}

type TaskLabelOutput struct {
	ID        uint      `json:"id"`
	TaskID    uint      `json:"task_id"`
	ProjectID uint      `json:"project_id"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	CreatedBy uint      `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TaskAttachmentOutput struct {
	ID        uint      `json:"id"`
	TaskID    uint      `json:"task_id"`
	ProjectID uint      `json:"project_id"`
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	CreatedBy uint      `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func NewTaskMetadataUsecase(
	labelRepo interfaces.TaskLabelRepository,
	attachmentRepo interfaces.TaskAttachmentRepository,
	taskRepo interfaces.TaskRepository,
	accessService *AccessService,
	cacheService interfaces.CacheService,
) *TaskMetadataUsecase {
	return &TaskMetadataUsecase{
		labelRepo:      labelRepo,
		attachmentRepo: attachmentRepo,
		taskRepo:       taskRepo,
		accessService:  accessService,
		cacheService:   cacheService,
	}
}

func (uc *TaskMetadataUsecase) SetActivityUsecase(activity *ActivityUsecase) {
	uc.activity = activity
}

func (uc *TaskMetadataUsecase) ListLabelsByTask(ctx context.Context, actorID uint, globalRole string, taskID uint) ([]TaskLabelOutput, error) {
	task, err := uc.getViewableTask(ctx, actorID, globalRole, taskID)
	if err != nil {
		return nil, err
	}

	cacheKey := fmt.Sprintf("task:%d:labels", task.ID)
	var cached []TaskLabelOutput
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached, nil
	}

	labels, err := uc.labelRepo.ListByTask(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	result := make([]TaskLabelOutput, 0, len(labels))
	for _, label := range labels {
		result = append(result, *toTaskLabelOutput(label, task.ProjectID))
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, result, readCacheTTL)
	return result, nil
}

func (uc *TaskMetadataUsecase) CreateLabel(ctx context.Context, actorID uint, globalRole string, taskID uint, input CreateTaskLabelInput) (*TaskLabelOutput, error) {
	task, err := uc.getEditableTask(ctx, actorID, globalRole, taskID)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("label name is required")
	}
	if len(name) > 80 {
		return nil, errors.New("label name is too long")
	}

	label := &domain.TaskLabel{
		TaskID:    task.ID,
		Name:      name,
		Color:     normalizeLabelColor(input.Color),
		CreatedBy: actorID,
	}

	if err := uc.labelRepo.Create(ctx, label); err != nil {
		return nil, err
	}

	uc.invalidateMetadataCaches(ctx, task.ID, task.ProjectID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskLabelCreated, fmt.Sprintf("Đã thêm nhãn \"%s\".", label.Name), task, map[string]interface{}{
		"label_id": label.ID,
		"name":     label.Name,
		"color":    label.Color,
	})

	return toTaskLabelOutput(label, task.ProjectID), nil
}

func (uc *TaskMetadataUsecase) UpdateLabel(ctx context.Context, actorID uint, globalRole string, labelID uint, input UpdateTaskLabelInput) (*TaskLabelOutput, error) {
	label, task, err := uc.getEditableLabel(ctx, actorID, globalRole, labelID)
	if err != nil {
		return nil, err
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, errors.New("label name cannot be empty")
		}
		if len(name) > 80 {
			return nil, errors.New("label name is too long")
		}
		label.Name = name
	}
	if input.Color != nil {
		label.Color = normalizeLabelColor(*input.Color)
	}

	if err := uc.labelRepo.Update(ctx, label); err != nil {
		return nil, err
	}

	uc.invalidateMetadataCaches(ctx, task.ID, task.ProjectID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskLabelUpdated, fmt.Sprintf("Đã cập nhật nhãn \"%s\".", label.Name), task, map[string]interface{}{
		"label_id": label.ID,
		"name":     label.Name,
		"color":    label.Color,
	})

	return toTaskLabelOutput(label, task.ProjectID), nil
}

func (uc *TaskMetadataUsecase) DeleteLabel(ctx context.Context, actorID uint, globalRole string, labelID uint) (uint, uint, error) {
	label, task, err := uc.getEditableLabel(ctx, actorID, globalRole, labelID)
	if err != nil {
		return 0, 0, err
	}

	if err := uc.labelRepo.Delete(ctx, label.ID); err != nil {
		return 0, 0, err
	}

	uc.invalidateMetadataCaches(ctx, task.ID, task.ProjectID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskLabelDeleted, fmt.Sprintf("Đã xóa nhãn \"%s\".", label.Name), task, map[string]interface{}{
		"label_id": label.ID,
		"name":     label.Name,
	})

	return task.ID, task.ProjectID, nil
}

func (uc *TaskMetadataUsecase) ListAttachmentsByTask(ctx context.Context, actorID uint, globalRole string, taskID uint) ([]TaskAttachmentOutput, error) {
	task, err := uc.getViewableTask(ctx, actorID, globalRole, taskID)
	if err != nil {
		return nil, err
	}

	cacheKey := fmt.Sprintf("task:%d:attachments", task.ID)
	var cached []TaskAttachmentOutput
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached, nil
	}

	attachments, err := uc.attachmentRepo.ListByTask(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	result := make([]TaskAttachmentOutput, 0, len(attachments))
	for _, attachment := range attachments {
		result = append(result, *toTaskAttachmentOutput(attachment, task.ProjectID))
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, result, readCacheTTL)
	return result, nil
}

func (uc *TaskMetadataUsecase) CreateAttachment(ctx context.Context, actorID uint, globalRole string, taskID uint, input CreateTaskAttachmentInput) (*TaskAttachmentOutput, error) {
	task, err := uc.getEditableTask(ctx, actorID, globalRole, taskID)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(input.Name)
	rawURL := strings.TrimSpace(input.URL)
	if name == "" {
		return nil, errors.New("attachment name is required")
	}
	if rawURL == "" {
		return nil, errors.New("attachment url is required")
	}
	if err := validateAttachmentURL(rawURL); err != nil {
		return nil, err
	}

	attachment := &domain.TaskAttachment{
		TaskID:    task.ID,
		Name:      name,
		URL:       rawURL,
		CreatedBy: actorID,
	}

	if err := uc.attachmentRepo.Create(ctx, attachment); err != nil {
		return nil, err
	}

	uc.invalidateMetadataCaches(ctx, task.ID, task.ProjectID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskAttachmentCreated, fmt.Sprintf("Đã thêm đính kèm \"%s\".", attachment.Name), task, map[string]interface{}{
		"attachment_id": attachment.ID,
		"name":          attachment.Name,
		"url":           attachment.URL,
	})

	return toTaskAttachmentOutput(attachment, task.ProjectID), nil
}

func (uc *TaskMetadataUsecase) UpdateAttachment(ctx context.Context, actorID uint, globalRole string, attachmentID uint, input UpdateTaskAttachmentInput) (*TaskAttachmentOutput, error) {
	attachment, task, err := uc.getEditableAttachment(ctx, actorID, globalRole, attachmentID)
	if err != nil {
		return nil, err
	}

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, errors.New("attachment name cannot be empty")
		}
		attachment.Name = name
	}
	if input.URL != nil {
		rawURL := strings.TrimSpace(*input.URL)
		if rawURL == "" {
			return nil, errors.New("attachment url cannot be empty")
		}
		if err := validateAttachmentURL(rawURL); err != nil {
			return nil, err
		}
		attachment.URL = rawURL
	}

	if err := uc.attachmentRepo.Update(ctx, attachment); err != nil {
		return nil, err
	}

	uc.invalidateMetadataCaches(ctx, task.ID, task.ProjectID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskAttachmentUpdated, fmt.Sprintf("Đã cập nhật đính kèm \"%s\".", attachment.Name), task, map[string]interface{}{
		"attachment_id": attachment.ID,
		"name":          attachment.Name,
		"url":           attachment.URL,
	})

	return toTaskAttachmentOutput(attachment, task.ProjectID), nil
}

func (uc *TaskMetadataUsecase) DeleteAttachment(ctx context.Context, actorID uint, globalRole string, attachmentID uint) (uint, uint, error) {
	attachment, task, err := uc.getEditableAttachment(ctx, actorID, globalRole, attachmentID)
	if err != nil {
		return 0, 0, err
	}

	if err := uc.attachmentRepo.Delete(ctx, attachment.ID); err != nil {
		return 0, 0, err
	}

	uc.invalidateMetadataCaches(ctx, task.ID, task.ProjectID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeTaskAttachmentDeleted, fmt.Sprintf("Đã xóa đính kèm \"%s\".", attachment.Name), task, map[string]interface{}{
		"attachment_id": attachment.ID,
		"name":          attachment.Name,
	})

	return task.ID, task.ProjectID, nil
}

func (uc *TaskMetadataUsecase) getViewableTask(ctx context.Context, actorID uint, globalRole string, taskID uint) (*domain.Task, error) {
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
	return task, nil
}

func (uc *TaskMetadataUsecase) getEditableTask(ctx context.Context, actorID uint, globalRole string, taskID uint) (*domain.Task, error) {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}

	role, err := uc.accessService.GetProjectRole(ctx, task.ProjectID, actorID, globalRole)
	if err != nil {
		return nil, err
	}

	isSystemAdmin := globalRole == domain.UserRoleAdmin
	isProjectMember := role == domain.ProjectRoleOwner ||
		role == domain.ProjectRoleAdmin ||
		role == domain.ProjectRoleMember
	if !isSystemAdmin && !isProjectMember {
		return nil, errors.New("forbidden: you are not a member of this project")
	}

	return task, nil
}

func (uc *TaskMetadataUsecase) getEditableLabel(ctx context.Context, actorID uint, globalRole string, labelID uint) (*domain.TaskLabel, *domain.Task, error) {
	label, err := uc.labelRepo.GetByID(ctx, labelID)
	if err != nil {
		return nil, nil, err
	}
	if label == nil {
		return nil, nil, errors.New("label not found")
	}
	task, err := uc.getEditableTask(ctx, actorID, globalRole, label.TaskID)
	if err != nil {
		return nil, nil, err
	}
	return label, task, nil
}

func (uc *TaskMetadataUsecase) getEditableAttachment(ctx context.Context, actorID uint, globalRole string, attachmentID uint) (*domain.TaskAttachment, *domain.Task, error) {
	attachment, err := uc.attachmentRepo.GetByID(ctx, attachmentID)
	if err != nil {
		return nil, nil, err
	}
	if attachment == nil {
		return nil, nil, errors.New("attachment not found")
	}
	task, err := uc.getEditableTask(ctx, actorID, globalRole, attachment.TaskID)
	if err != nil {
		return nil, nil, err
	}
	return attachment, task, nil
}

func (uc *TaskMetadataUsecase) invalidateMetadataCaches(ctx context.Context, taskID uint, projectID uint) {
	deleteCacheKeys(ctx, uc.cacheService,
		fmt.Sprintf("task:%d:detail", taskID),
		fmt.Sprintf("task:%d:labels", taskID),
		fmt.Sprintf("task:%d:attachments", taskID),
	)
	deleteCachePatterns(ctx, uc.cacheService,
		fmt.Sprintf("task:%d:activities:*", taskID),
		fmt.Sprintf("project:%d:tasks:*", projectID),
		"user:*:tasks:*",
	)
}

func (uc *TaskMetadataUsecase) recordActivity(ctx context.Context, actorID uint, activityType string, message string, task *domain.Task, payload map[string]interface{}) {
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

func normalizeLabelColor(color string) string {
	color = strings.ToLower(strings.TrimSpace(color))
	switch color {
	case "blue", "green", "yellow", "orange", "red", "purple", "pink", "sky", "slate":
		return color
	default:
		return "blue"
	}
}

func validateAttachmentURL(rawURL string) error {
	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return errors.New("attachment url must be a valid absolute url")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errors.New("attachment url must use http or https")
	}
	return nil
}

func toTaskLabelOutput(label *domain.TaskLabel, projectID uint) *TaskLabelOutput {
	return &TaskLabelOutput{
		ID:        label.ID,
		TaskID:    label.TaskID,
		ProjectID: projectID,
		Name:      label.Name,
		Color:     label.Color,
		CreatedBy: label.CreatedBy,
		CreatedAt: label.CreatedAt,
		UpdatedAt: label.UpdatedAt,
	}
}

func toTaskAttachmentOutput(attachment *domain.TaskAttachment, projectID uint) *TaskAttachmentOutput {
	return &TaskAttachmentOutput{
		ID:        attachment.ID,
		TaskID:    attachment.TaskID,
		ProjectID: projectID,
		Name:      attachment.Name,
		URL:       attachment.URL,
		CreatedBy: attachment.CreatedBy,
		CreatedAt: attachment.CreatedAt,
		UpdatedAt: attachment.UpdatedAt,
	}
}
