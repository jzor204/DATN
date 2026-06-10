package interfaces

import (
	"context"

	"task-management/internal/domain"
)

type TaskChangeRequestRepository interface {
	Create(ctx context.Context, request *domain.TaskChangeRequest) error
	GetByID(ctx context.Context, id uint) (*domain.TaskChangeRequest, error)
	UpdateReview(ctx context.Context, request *domain.TaskChangeRequest) error
}
