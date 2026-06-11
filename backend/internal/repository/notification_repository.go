package repository

import (
	"context"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type NotificationRepository struct {
	db *gorm.DB
}

type notificationModel struct {
	ID          uint       `gorm:"column:id;primaryKey;autoIncrement"`
	UserID      uint       `gorm:"column:user_id;not null"`
	ActorID     *uint      `gorm:"column:actor_id"`
	Type        string     `gorm:"column:type;size:80;not null"`
	Title       string     `gorm:"column:title;size:255;not null"`
	Message     string     `gorm:"column:message;type:text"`
	PayloadJSON string     `gorm:"column:payload_json;type:json"`
	ReadAt      *time.Time `gorm:"column:read_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
}

func (notificationModel) TableName() string {
	return "notifications"
}

func NewNotificationRepository(db *gorm.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

func (r *NotificationRepository) Create(ctx context.Context, notification *domain.Notification) error {
	row := &notificationModel{
		UserID:      notification.UserID,
		ActorID:     notification.ActorID,
		Type:        notification.Type,
		Title:       notification.Title,
		Message:     notification.Message,
		PayloadJSON: notification.PayloadJSON,
	}

	if row.PayloadJSON == "" {
		row.PayloadJSON = "{}"
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	notification.ID = row.ID
	notification.CreatedAt = row.CreatedAt
	notification.UpdatedAt = row.UpdatedAt
	return nil
}

func (r *NotificationRepository) ListByUser(ctx context.Context, userID uint, page int, pageSize int) ([]*domain.Notification, int64, error) {
	var (
		rows  []notificationModel
		total int64
	)

	if err := r.db.WithContext(ctx).
		Model(&notificationModel{}).
		Where("user_id = ?", userID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.Notification, 0, len(rows))
	for i := range rows {
		result = append(result, mapNotificationModelToDomain(rows[i]))
	}

	return result, total, nil
}

func (r *NotificationRepository) MarkRead(ctx context.Context, id uint, userID uint) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).
		Model(&notificationModel{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("read_at", &now).Error
}

func (r *NotificationRepository) MarkAllRead(ctx context.Context, userID uint) error {
	now := time.Now().UTC()
	return r.db.WithContext(ctx).
		Model(&notificationModel{}).
		Where("user_id = ? AND read_at IS NULL", userID).
		Update("read_at", &now).Error
}

func mapNotificationModelToDomain(row notificationModel) *domain.Notification {
	return &domain.Notification{
		ID:          row.ID,
		UserID:      row.UserID,
		ActorID:     row.ActorID,
		Type:        row.Type,
		Title:       row.Title,
		Message:     row.Message,
		PayloadJSON: row.PayloadJSON,
		ReadAt:      row.ReadAt,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}
