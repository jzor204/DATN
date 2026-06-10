package interfaces

import (
	"context"

	"task-management/internal/domain"
)

type NotificationRepository interface {
	Create(ctx context.Context, notification *domain.Notification) error
	ListByUser(ctx context.Context, userID uint, page int, pageSize int) ([]*domain.Notification, int64, error)
	MarkRead(ctx context.Context, id uint, userID uint) error
}
