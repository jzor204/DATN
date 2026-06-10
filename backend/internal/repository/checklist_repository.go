package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type ChecklistRepository struct {
	db *gorm.DB
}

type checklistModel struct {
	ID        uint      `gorm:"column:id;primaryKey;autoIncrement"`
	TaskID    uint      `gorm:"column:task_id;not null"`
	Title     string    `gorm:"column:title;size:255;not null"`
	Position  int       `gorm:"column:position;not null"`
	CreatedBy uint      `gorm:"column:created_by;not null"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (checklistModel) TableName() string {
	return "checklists"
}

func NewChecklistRepository(db *gorm.DB) *ChecklistRepository {
	return &ChecklistRepository{db: db}
}

func (r *ChecklistRepository) Create(ctx context.Context, checklist *domain.Checklist) error {
	row := &checklistModel{
		TaskID:    checklist.TaskID,
		Title:     checklist.Title,
		Position:  checklist.Position,
		CreatedBy: checklist.CreatedBy,
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	checklist.ID = row.ID
	checklist.CreatedAt = row.CreatedAt
	checklist.UpdatedAt = row.UpdatedAt
	return nil
}

func (r *ChecklistRepository) GetByID(ctx context.Context, id uint) (*domain.Checklist, error) {
	var row checklistModel

	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapChecklistModelToDomain(row), nil
}

func (r *ChecklistRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&checklistModel{}, id).Error
}

func (r *ChecklistRepository) ListByTask(ctx context.Context, taskID uint) ([]*domain.Checklist, error) {
	var rows []checklistModel

	if err := r.db.WithContext(ctx).
		Where("task_id = ?", taskID).
		Order("position ASC, id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]*domain.Checklist, 0, len(rows))
	for i := range rows {
		result = append(result, mapChecklistModelToDomain(rows[i]))
	}

	return result, nil
}

func (r *ChecklistRepository) NextPosition(ctx context.Context, taskID uint) (int, error) {
	var maxPosition sql.NullInt64

	if err := r.db.WithContext(ctx).
		Model(&checklistModel{}).
		Where("task_id = ?", taskID).
		Select("MAX(position)").
		Scan(&maxPosition).Error; err != nil {
		return 0, err
	}

	if !maxPosition.Valid {
		return 1, nil
	}

	return int(maxPosition.Int64) + 1, nil
}

func mapChecklistModelToDomain(row checklistModel) *domain.Checklist {
	return &domain.Checklist{
		ID:        row.ID,
		TaskID:    row.TaskID,
		Title:     row.Title,
		Position:  row.Position,
		CreatedBy: row.CreatedBy,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
		Items:     []*domain.ChecklistItem{},
	}
}
