package repository

import (
	"context"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type TaskRepository struct {
	db *gorm.DB
}

type taskModel struct {
	ID          uint      `gorm:"column:id;primaryKey;autoIncrement"`
	ProjectID   uint      `gorm:"column:project_id;not null"`
	Title       string    `gorm:"column:title;size:255;not null"`
	Description string    `gorm:"column:description;type:text"`
	Status      string    `gorm:"column:status;size:50;not null"`
	AssigneeID  *uint     `gorm:"column:assignee_id"`
	CreatedBy   uint      `gorm:"column:created_by;not null"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

func (taskModel) TableName() string {
	return "tasks"
}

func NewTaskRepository(db *gorm.DB) *TaskRepository {
	return &TaskRepository{
		db: db,
	}
}

func (r *TaskRepository) Create(ctx context.Context, task *domain.Task) error {
	row := &taskModel{
		ProjectID:   task.ProjectID,
		Title:       task.Title,
		Description: task.Description,
		Status:      task.Status,
		AssigneeID:  task.AssigneeID,
		CreatedBy:   task.CreatedBy,
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	task.ID = row.ID
	task.CreatedAt = row.CreatedAt
	task.UpdatedAt = row.UpdatedAt

	return nil
}

func (r *TaskRepository) GetByID(ctx context.Context, id uint) (*domain.Task, error) {
	var row taskModel

	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapTaskModelToDomain(row), nil
}

func (r *TaskRepository) Update(ctx context.Context, task *domain.Task) error {
	result := r.db.WithContext(ctx).
		Model(&taskModel{}).
		Where("id = ?", task.ID).
		Updates(map[string]interface{}{
			"title":       task.Title,
			"description": task.Description,
			"status":      task.Status,
			"assignee_id": task.AssigneeID,
		})
	if result.Error != nil {
		return result.Error
	}

	refreshed, err := r.GetByID(ctx, task.ID)
	if err != nil {
		return err
	}
	if refreshed != nil {
		task.CreatedAt = refreshed.CreatedAt
		task.UpdatedAt = refreshed.UpdatedAt
	}

	return nil
}

func (r *TaskRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).
		Delete(&taskModel{}, id).Error
}

func (r *TaskRepository) ListByProject(ctx context.Context, projectID uint, page int, pageSize int) ([]*domain.Task, int64, error) {
	var (
		rows  []taskModel
		total int64
	)

	if err := r.db.WithContext(ctx).
		Model(&taskModel{}).
		Where("project_id = ?", projectID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.Task, 0, len(rows))
	for i := range rows {
		result = append(result, mapTaskModelToDomain(rows[i]))
	}

	return result, total, nil
}

func mapTaskModelToDomain(row taskModel) *domain.Task {
	return &domain.Task{
		ID:          row.ID,
		ProjectID:   row.ProjectID,
		Title:       row.Title,
		Description: row.Description,
		Status:      row.Status,
		AssigneeID:  row.AssigneeID,
		CreatedBy:   row.CreatedBy,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}
