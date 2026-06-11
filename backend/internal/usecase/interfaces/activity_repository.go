package interfaces

import (
	"context"

	"task-management/internal/domain"
)

type ActivityRepository interface {
	Create(ctx context.Context, activity *domain.Activity) error
	ListByTask(ctx context.Context, taskID uint, page int, pageSize int) ([]*domain.Activity, int64, error)
}
