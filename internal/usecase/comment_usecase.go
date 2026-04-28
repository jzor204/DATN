package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

type CommentUsecase struct {
	commentRepo   interfaces.CommentRepository
	taskRepo      interfaces.TaskRepository
	accessService *AccessService
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

func NewCommentUsecase(
	commentRepo interfaces.CommentRepository,
	taskRepo interfaces.TaskRepository,
	accessService *AccessService,
) *CommentUsecase {
	return &CommentUsecase{
		commentRepo:   commentRepo,
		taskRepo:      taskRepo,
		accessService: accessService,
	}
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

	comments, total, err := uc.commentRepo.ListByTask(ctx, taskID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	result := make([]CommentOutput, 0, len(comments))
	for _, comment := range comments {
		result = append(result, *toCommentOutput(comment))
	}

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

	return uc.commentRepo.Delete(ctx, commentID)
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
