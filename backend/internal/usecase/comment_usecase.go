package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

type CommentUsecase struct {
	commentRepo   interfaces.CommentRepository
	taskRepo      interfaces.TaskRepository
	accessService *AccessService
	cacheService  interfaces.CacheService
	activity      *ActivityUsecase
}

type CreateCommentInput struct {
	Content string
}

type UpdateCommentInput struct {
	Content string
}

type CommentOutput struct {
	ID        uint      `json:"id"`
	TaskID    uint      `json:"task_id"`
	AuthorID  uint      `json:"author_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type commentListCacheEntry struct {
	Data  []CommentOutput `json:"data"`
	Total int64           `json:"total"`
}

func NewCommentUsecase(
	commentRepo interfaces.CommentRepository,
	taskRepo interfaces.TaskRepository,
	accessService *AccessService,
	cacheService interfaces.CacheService,
) *CommentUsecase {
	return &CommentUsecase{
		commentRepo:   commentRepo,
		taskRepo:      taskRepo,
		accessService: accessService,
		cacheService:  cacheService,
	}
}

func (uc *CommentUsecase) SetActivityUsecase(activity *ActivityUsecase) {
	uc.activity = activity
}

func (uc *CommentUsecase) GetByID(
	ctx context.Context,
	actorID uint,
	globalRole string,
	commentID uint,
) (*CommentOutput, error) {
	cacheKey := fmt.Sprintf("comment:%d:detail", commentID)
	var cached CommentOutput
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		task, err := uc.taskRepo.GetByID(ctx, cached.TaskID)
		if err != nil {
			return nil, err
		}
		if task == nil {
			return nil, errors.New("task not found")
		}
		if err := uc.accessService.CanViewProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
			return nil, err
		}
		return &cached, nil
	}

	comment, err := uc.commentRepo.GetByID(ctx, commentID)
	if err != nil {
		return nil, err
	}
	if comment == nil {
		return nil, errors.New("comment not found")
	}

	task, err := uc.taskRepo.GetByID(ctx, comment.TaskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}

	if err := uc.accessService.CanViewProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
		return nil, err
	}

	output := toCommentOutput(comment)
	setCachedJSON(ctx, uc.cacheService, cacheKey, output, readCacheTTL)

	return output, nil
}

func (uc *CommentUsecase) ListByTask(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
	page int,
	pageSize int,
) ([]CommentOutput, int64, error) {
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

	page, pageSize = normalizePagination(page, pageSize)
	cacheKey := fmt.Sprintf("task:%d:comments:page:%d:size:%d", taskID, page, pageSize)

	var cached commentListCacheEntry
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached.Data, cached.Total, nil
	}

	comments, total, err := uc.commentRepo.ListByTask(ctx, taskID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	result := make([]CommentOutput, 0, len(comments))
	for _, comment := range comments {
		result = append(result, *toCommentOutput(comment))
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, commentListCacheEntry{
		Data:  result,
		Total: total,
	}, readCacheTTL)

	return result, total, nil
}

func (uc *CommentUsecase) Create(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
	input CreateCommentInput,
) (*CommentOutput, error) {
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

	content := strings.TrimSpace(input.Content)
	if content == "" {
		return nil, errors.New("comment content is required")
	}

	comment := &domain.Comment{
		TaskID:   taskID,
		AuthorID: actorID,
		Content:  content,
	}

	if err := uc.commentRepo.Create(ctx, comment); err != nil {
		return nil, err
	}

	uc.invalidateCommentCaches(ctx, comment.ID, taskID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeCommentCreated, "Đã thêm bình luận.", task, map[string]interface{}{
		"comment_id": comment.ID,
	})

	return toCommentOutput(comment), nil
}

func (uc *CommentUsecase) Update(
	ctx context.Context,
	actorID uint,
	globalRole string,
	commentID uint,
	input UpdateCommentInput,
) (*CommentOutput, error) {
	comment, err := uc.commentRepo.GetByID(ctx, commentID)
	if err != nil {
		return nil, err
	}
	if comment == nil {
		return nil, errors.New("comment not found")
	}

	task, err := uc.taskRepo.GetByID(ctx, comment.TaskID)
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
	isProjectManager := role == domain.ProjectRoleOwner || role == domain.ProjectRoleAdmin
	isAuthor := comment.AuthorID == actorID

	if !isSystemAdmin && !isProjectManager && !isAuthor {
		return nil, errors.New("forbidden: you do not have permission to update this comment")
	}

	content := strings.TrimSpace(input.Content)
	if content == "" {
		return nil, errors.New("comment content is required")
	}

	comment.Content = content

	if err := uc.commentRepo.Update(ctx, comment); err != nil {
		return nil, err
	}

	uc.invalidateCommentCaches(ctx, comment.ID, comment.TaskID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeCommentUpdated, "Đã chỉnh sửa bình luận.", task, map[string]interface{}{
		"comment_id": comment.ID,
	})

	return toCommentOutput(comment), nil
}

func (uc *CommentUsecase) Delete(
	ctx context.Context,
	actorID uint,
	globalRole string,
	commentID uint,
) error {
	comment, err := uc.commentRepo.GetByID(ctx, commentID)
	if err != nil {
		return err
	}
	if comment == nil {
		return errors.New("comment not found")
	}

	task, err := uc.taskRepo.GetByID(ctx, comment.TaskID)
	if err != nil {
		return err
	}
	if task == nil {
		return errors.New("task not found")
	}

	role, err := uc.accessService.GetProjectRole(ctx, task.ProjectID, actorID, globalRole)
	if err != nil {
		return err
	}

	isSystemAdmin := globalRole == domain.UserRoleAdmin
	isProjectManager := role == domain.ProjectRoleOwner || role == domain.ProjectRoleAdmin
	isAuthor := comment.AuthorID == actorID

	if !isSystemAdmin && !isProjectManager && !isAuthor {
		return errors.New("forbidden: you do not have permission to delete this comment")
	}

	if err := uc.commentRepo.Delete(ctx, commentID); err != nil {
		return err
	}

	uc.invalidateCommentCaches(ctx, commentID, comment.TaskID)
	uc.recordActivity(ctx, actorID, domain.ActivityTypeCommentDeleted, "Đã xóa bình luận.", task, map[string]interface{}{
		"comment_id": commentID,
	})
	return nil
}

func (uc *CommentUsecase) invalidateCommentCaches(ctx context.Context, commentID uint, taskID uint) {
	deleteCacheKeys(ctx, uc.cacheService, fmt.Sprintf("comment:%d:detail", commentID))
	deleteCachePatterns(ctx, uc.cacheService, fmt.Sprintf("task:%d:comments:*", taskID))
}

func (uc *CommentUsecase) recordActivity(
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

func toCommentOutput(comment *domain.Comment) *CommentOutput {
	return &CommentOutput{
		ID:        comment.ID,
		TaskID:    comment.TaskID,
		AuthorID:  comment.AuthorID,
		Content:   comment.Content,
		CreatedAt: comment.CreatedAt,
		UpdatedAt: comment.UpdatedAt,
	}
}
