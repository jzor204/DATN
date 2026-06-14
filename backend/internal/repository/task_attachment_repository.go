package repository

import (
	"context"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type TaskAttachmentRepository struct {
	db *gorm.DB
}

type taskAttachmentModel struct {
	ID        uint      `gorm:"column:id;primaryKey;autoIncrement"`
	TaskID    uint      `gorm:"column:task_id;not null"`
	Name      string    `gorm:"column:name;size:255;not null"`
	URL       string    `gorm:"column:url;type:text;not null"`
	CreatedBy uint      `gorm:"column:created_by;not null"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (taskAttachmentModel) TableName() string {
	return "task_attachments"
}

func NewTaskAttachmentRepository(db *gorm.DB) *TaskAttachmentRepository {
	return &TaskAttachmentRepository{db: db}
}

func (r *TaskAttachmentRepository) Create(ctx context.Context, attachment *domain.TaskAttachment) error {
	row := &taskAttachmentModel{
		TaskID:    attachment.TaskID,
		Name:      attachment.Name,
		URL:       attachment.URL,
		CreatedBy: attachment.CreatedBy,
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	attachment.ID = row.ID
	attachment.CreatedAt = row.CreatedAt
	attachment.UpdatedAt = row.UpdatedAt
	return nil
}

func (r *TaskAttachmentRepository) GetByID(ctx context.Context, id uint) (*domain.TaskAttachment, error) {
	var row taskAttachmentModel

	err := r.db.WithContext(ctx).Where("id = ?", id).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapTaskAttachmentModelToDomain(row), nil
}

func (r *TaskAttachmentRepository) Update(ctx context.Context, attachment *domain.TaskAttachment) error {
	result := r.db.WithContext(ctx).
		Model(&taskAttachmentModel{}).
		Where("id = ?", attachment.ID).
		Updates(map[string]interface{}{
			"name": attachment.Name,
			"url":  attachment.URL,
		})
	if result.Error != nil {
		return result.Error
	}

	refreshed, err := r.GetByID(ctx, attachment.ID)
	if err != nil {
		return err
	}
	if refreshed != nil {
		attachment.UpdatedAt = refreshed.UpdatedAt
	}

	return nil
}

func (r *TaskAttachmentRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&taskAttachmentModel{}, id).Error
}

func (r *TaskAttachmentRepository) ListByTask(ctx context.Context, taskID uint) ([]*domain.TaskAttachment, error) {
	var rows []taskAttachmentModel

	if err := r.db.WithContext(ctx).
		Where("task_id = ?", taskID).
		Order("created_at DESC, id DESC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]*domain.TaskAttachment, 0, len(rows))
	for i := range rows {
		result = append(result, mapTaskAttachmentModelToDomain(rows[i]))
	}

	return result, nil
}

func mapTaskAttachmentModelToDomain(row taskAttachmentModel) *domain.TaskAttachment {
	return &domain.TaskAttachment{
		ID:        row.ID,
		TaskID:    row.TaskID,
		Name:      row.Name,
		URL:       row.URL,
		CreatedBy: row.CreatedBy,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
}
