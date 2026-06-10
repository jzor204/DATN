package interfaces

import (
	"context"
	"task-management/internal/domain"
)

type TaskRepository interface {
	Create(ctx context.Context, task *domain.Task) error
	GetByID(ctx context.Context, id uint) (*domain.Task, error)
	Update(ctx context.Context, task *domain.Task) error
	UpdateProgress(ctx context.Context, taskID uint, progress int) error
	Delete(ctx context.Context, id uint) error

	ListByProject(ctx context.Context, projectID uint, page int, pageSize int) ([]*domain.Task, int64, error)
	ListAssignedToUser(ctx context.Context, userID uint, projectID *uint, status string, requireMembership bool, page int, pageSize int) ([]*domain.Task, int64, error)
}
