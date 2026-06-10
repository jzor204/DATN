package interfaces

import (
	"context"
	"task-management/internal/domain"
)

type ChecklistItemRepository interface {
	Create(ctx context.Context, item *domain.ChecklistItem) error
	GetByID(ctx context.Context, id uint) (*domain.ChecklistItem, error)
	Update(ctx context.Context, item *domain.ChecklistItem) error
	Delete(ctx context.Context, id uint) error
	ListByTask(ctx context.Context, taskID uint) ([]*domain.ChecklistItem, error)
	ListByChecklist(ctx context.Context, checklistID uint) ([]*domain.ChecklistItem, error)
	CountByTask(ctx context.Context, taskID uint) (total int64, done int64, err error)
	NextPosition(ctx context.Context, checklistID uint) (int, error)
}
