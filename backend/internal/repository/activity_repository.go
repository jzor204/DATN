package repository

import (
	"context"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type ActivityRepository struct {
	db *gorm.DB
}

type activityModel struct {
	ID          uint      `gorm:"column:id;primaryKey;autoIncrement"`
	ProjectID   uint      `gorm:"column:project_id;not null"`
	TaskID      *uint     `gorm:"column:task_id"`
	ActorID     *uint     `gorm:"column:actor_id"`
	Type        string    `gorm:"column:type;size:100;not null"`
	Message     string    `gorm:"column:message;type:text;not null"`
	PayloadJSON string    `gorm:"column:payload_json;type:json"`
	CreatedAt   time.Time `gorm:"column:created_at"`
}

func (activityModel) TableName() string {
	return "activities"
}

func NewActivityRepository(db *gorm.DB) *ActivityRepository {
	return &ActivityRepository{db: db}
}

func (r *ActivityRepository) Create(ctx context.Context, activity *domain.Activity) error {
	row := &activityModel{
		ProjectID:   activity.ProjectID,
		TaskID:      activity.TaskID,
		ActorID:     activity.ActorID,
		Type:        activity.Type,
		Message:     activity.Message,
		PayloadJSON: activity.PayloadJSON,
	}
	if row.PayloadJSON == "" {
		row.PayloadJSON = "{}"
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	activity.ID = row.ID
	activity.CreatedAt = row.CreatedAt
	return nil
}

func (r *ActivityRepository) ListByTask(ctx context.Context, taskID uint, page int, pageSize int) ([]*domain.Activity, int64, error) {
	var (
		rows  []activityModel
		total int64
	)

	if err := r.db.WithContext(ctx).
		Model(&activityModel{}).
		Where("task_id = ?", taskID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).
		Where("task_id = ?", taskID).
		Order("created_at DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.Activity, 0, len(rows))
	for i := range rows {
		result = append(result, mapActivityModelToDomain(rows[i]))
	}

	return result, total, nil
}

func mapActivityModelToDomain(row activityModel) *domain.Activity {
	return &domain.Activity{
		ID:          row.ID,
		ProjectID:   row.ProjectID,
		TaskID:      row.TaskID,
		ActorID:     row.ActorID,
		Type:        row.Type,
		Message:     row.Message,
		PayloadJSON: row.PayloadJSON,
		CreatedAt:   row.CreatedAt,
	}
}
