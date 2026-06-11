package interfaces

import (
	"context"

	"task-management/internal/domain"
)

type TaskChangeRequestRepository interface {
	Create(ctx context.Context, request *domain.TaskChangeRequest) error
	GetByID(ctx context.Context, id uint) (*domain.TaskChangeRequest, error)
	ListByTask(ctx context.Context, taskID uint, requesterID *uint, page int, pageSize int) ([]*domain.TaskChangeRequest, int64, error)
	HasPendingByTaskAndRequester(ctx context.Context, taskID uint, requesterID uint) (bool, error)
	UpdateReview(ctx context.Context, request *domain.TaskChangeRequest) error
}
