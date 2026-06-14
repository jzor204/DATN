package repository

import (
	"context"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type TaskLabelRepository struct {
	db *gorm.DB
}

type taskLabelModel struct {
	ID        uint      `gorm:"column:id;primaryKey;autoIncrement"`
	TaskID    uint      `gorm:"column:task_id;not null"`
	Name      string    `gorm:"column:name;size:80;not null"`
	Color     string    `gorm:"column:color;size:30;not null"`
	CreatedBy uint      `gorm:"column:created_by;not null"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (taskLabelModel) TableName() string {
	return "task_labels"
}

func NewTaskLabelRepository(db *gorm.DB) *TaskLabelRepository {
	return &TaskLabelRepository{db: db}
}

func (r *TaskLabelRepository) Create(ctx context.Context, label *domain.TaskLabel) error {
	row := &taskLabelModel{
		TaskID:    label.TaskID,
		Name:      label.Name,
		Color:     label.Color,
		CreatedBy: label.CreatedBy,
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	label.ID = row.ID
	label.CreatedAt = row.CreatedAt
	label.UpdatedAt = row.UpdatedAt
	return nil
}

func (r *TaskLabelRepository) GetByID(ctx context.Context, id uint) (*domain.TaskLabel, error) {
	var row taskLabelModel

	err := r.db.WithContext(ctx).Where("id = ?", id).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapTaskLabelModelToDomain(row), nil
}

func (r *TaskLabelRepository) Update(ctx context.Context, label *domain.TaskLabel) error {
	result := r.db.WithContext(ctx).
		Model(&taskLabelModel{}).
		Where("id = ?", label.ID).
		Updates(map[string]interface{}{
			"name":  label.Name,
			"color": label.Color,
		})
	if result.Error != nil {
		return result.Error
	}

	refreshed, err := r.GetByID(ctx, label.ID)
	if err != nil {
		return err
	}
	if refreshed != nil {
		label.UpdatedAt = refreshed.UpdatedAt
	}

	return nil
}

func (r *TaskLabelRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&taskLabelModel{}, id).Error
}

func (r *TaskLabelRepository) ListByTask(ctx context.Context, taskID uint) ([]*domain.TaskLabel, error) {
	var rows []taskLabelModel

	if err := r.db.WithContext(ctx).
		Where("task_id = ?", taskID).
		Order("id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]*domain.TaskLabel, 0, len(rows))
	for i := range rows {
		result = append(result, mapTaskLabelModelToDomain(rows[i]))
	}

	return result, nil
}

func mapTaskLabelModelToDomain(row taskLabelModel) *domain.TaskLabel {
	return &domain.TaskLabel{
		ID:        row.ID,
		TaskID:    row.TaskID,
		Name:      row.Name,
		Color:     row.Color,
		CreatedBy: row.CreatedBy,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
}
