package interfaces

import (
	"context"

	"task-management/internal/domain"
)

type ChecklistRepository interface {
	Create(ctx context.Context, checklist *domain.Checklist) error
	GetByID(ctx context.Context, id uint) (*domain.Checklist, error)
	Delete(ctx context.Context, id uint) error
	ListByTask(ctx context.Context, taskID uint) ([]*domain.Checklist, error)
	NextPosition(ctx context.Context, taskID uint) (int, error)
}
