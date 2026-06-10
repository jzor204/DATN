package repository

import (
	"context"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type TaskChangeRequestRepository struct {
	db *gorm.DB
}

type taskChangeRequestModel struct {
	ID          uint       `gorm:"column:id;primaryKey;autoIncrement"`
	TaskID      uint       `gorm:"column:task_id;not null"`
	ProjectID   uint       `gorm:"column:project_id;not null"`
	RequestedBy uint       `gorm:"column:requested_by;not null"`
	PayloadJSON string     `gorm:"column:payload_json;type:json;not null"`
	Reason      string     `gorm:"column:reason;type:text"`
	Status      string     `gorm:"column:status;size:50;not null"`
	ReviewedBy  *uint      `gorm:"column:reviewed_by"`
	ReviewedAt  *time.Time `gorm:"column:reviewed_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
}

func (taskChangeRequestModel) TableName() string {
	return "task_change_requests"
}

func NewTaskChangeRequestRepository(db *gorm.DB) *TaskChangeRequestRepository {
	return &TaskChangeRequestRepository{db: db}
}

func (r *TaskChangeRequestRepository) Create(ctx context.Context, request *domain.TaskChangeRequest) error {
	row := &taskChangeRequestModel{
		TaskID:      request.TaskID,
		ProjectID:   request.ProjectID,
		RequestedBy: request.RequestedBy,
		PayloadJSON: request.PayloadJSON,
		Reason:      request.Reason,
		Status:      request.Status,
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	request.ID = row.ID
	request.CreatedAt = row.CreatedAt
	request.UpdatedAt = row.UpdatedAt
	return nil
}

func (r *TaskChangeRequestRepository) GetByID(ctx context.Context, id uint) (*domain.TaskChangeRequest, error) {
	var row taskChangeRequestModel

	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapTaskChangeRequestModelToDomain(row), nil
}

func (r *TaskChangeRequestRepository) UpdateReview(ctx context.Context, request *domain.TaskChangeRequest) error {
	result := r.db.WithContext(ctx).
		Model(&taskChangeRequestModel{}).
		Where("id = ?", request.ID).
		Updates(map[string]interface{}{
			"status":      request.Status,
			"reviewed_by": request.ReviewedBy,
			"reviewed_at": request.ReviewedAt,
		})
	if result.Error != nil {
		return result.Error
	}

	refreshed, err := r.GetByID(ctx, request.ID)
	if err != nil {
		return err
	}
	if refreshed != nil {
		*request = *refreshed
	}

	return nil
}

func mapTaskChangeRequestModelToDomain(row taskChangeRequestModel) *domain.TaskChangeRequest {
	return &domain.TaskChangeRequest{
		ID:          row.ID,
		TaskID:      row.TaskID,
		ProjectID:   row.ProjectID,
		RequestedBy: row.RequestedBy,
		PayloadJSON: row.PayloadJSON,
		Reason:      row.Reason,
		Status:      row.Status,
		ReviewedBy:  row.ReviewedBy,
		ReviewedAt:  row.ReviewedAt,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}
