package interfaces

import (
	"context"

	"task-management/internal/domain"
)

type TaskLabelRepository interface {
	Create(ctx context.Context, label *domain.TaskLabel) error
	GetByID(ctx context.Context, id uint) (*domain.TaskLabel, error)
	Update(ctx context.Context, label *domain.TaskLabel) error
	Delete(ctx context.Context, id uint) error
	ListByTask(ctx context.Context, taskID uint) ([]*domain.TaskLabel, error)
}

type TaskAttachmentRepository interface {
	Create(ctx context.Context, attachment *domain.TaskAttachment) error
	GetByID(ctx context.Context, id uint) (*domain.TaskAttachment, error)
	Update(ctx context.Context, attachment *domain.TaskAttachment) error
	Delete(ctx context.Context, id uint) error
	ListByTask(ctx context.Context, taskID uint) ([]*domain.TaskAttachment, error)
}
