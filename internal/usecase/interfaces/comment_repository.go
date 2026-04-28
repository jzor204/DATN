package interfaces

import (
	"context"
	"task-management/internal/domain"
)

type CommentRepository interface {
	Create(ctx context.Context, comment *domain.Comment) error
	GetByID(ctx context.Context, id uint) (*domain.Comment, error)
	Update(ctx context.Context, comment *domain.Comment) error
	Delete(ctx context.Context, id uint) error
	ListByTask(ctx context.Context, taskID uint, page int, pageSize int) ([]*domain.Comment, int64, error)
}
