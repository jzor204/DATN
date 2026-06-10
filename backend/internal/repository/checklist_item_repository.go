package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type ChecklistItemRepository struct {
	db *gorm.DB
}

type checklistItemModel struct {
	ID          uint      `gorm:"column:id;primaryKey;autoIncrement"`
	ChecklistID uint      `gorm:"column:checklist_id;not null"`
	TaskID      uint      `gorm:"column:task_id;not null"`
	Title       string    `gorm:"column:title;size:255;not null"`
	IsDone      bool      `gorm:"column:is_done;not null"`
	Position    int       `gorm:"column:position;not null"`
	CreatedBy   uint      `gorm:"column:created_by;not null"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

func (checklistItemModel) TableName() string {
	return "checklist_items"
}

func NewChecklistItemRepository(db *gorm.DB) *ChecklistItemRepository {
	return &ChecklistItemRepository{db: db}
}

func (r *ChecklistItemRepository) Create(ctx context.Context, item *domain.ChecklistItem) error {
	row := &checklistItemModel{
		ChecklistID: item.ChecklistID,
		TaskID:      item.TaskID,
		Title:       item.Title,
		IsDone:      item.IsDone,
		Position:    item.Position,
		CreatedBy:   item.CreatedBy,
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	item.ID = row.ID
	item.CreatedAt = row.CreatedAt
	item.UpdatedAt = row.UpdatedAt
	return nil
}

func (r *ChecklistItemRepository) GetByID(ctx context.Context, id uint) (*domain.ChecklistItem, error) {
	var row checklistItemModel

	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapChecklistItemModelToDomain(row), nil
}

func (r *ChecklistItemRepository) Update(ctx context.Context, item *domain.ChecklistItem) error {
	result := r.db.WithContext(ctx).
		Model(&checklistItemModel{}).
		Where("id = ?", item.ID).
		Updates(map[string]interface{}{
			"title":   item.Title,
			"is_done": item.IsDone,
		})
	if result.Error != nil {
		return result.Error
	}

	refreshed, err := r.GetByID(ctx, item.ID)
	if err != nil {
		return err
	}
	if refreshed != nil {
		item.CreatedAt = refreshed.CreatedAt
		item.UpdatedAt = refreshed.UpdatedAt
	}

	return nil
}

func (r *ChecklistItemRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&checklistItemModel{}, id).Error
}

func (r *ChecklistItemRepository) ListByTask(ctx context.Context, taskID uint) ([]*domain.ChecklistItem, error) {
	var rows []checklistItemModel

	if err := r.db.WithContext(ctx).
		Where("task_id = ?", taskID).
		Order("checklist_id ASC, position ASC, id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]*domain.ChecklistItem, 0, len(rows))
	for i := range rows {
		result = append(result, mapChecklistItemModelToDomain(rows[i]))
	}

	return result, nil
}

func (r *ChecklistItemRepository) ListByChecklist(ctx context.Context, checklistID uint) ([]*domain.ChecklistItem, error) {
	var rows []checklistItemModel

	if err := r.db.WithContext(ctx).
		Where("checklist_id = ?", checklistID).
		Order("position ASC, id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]*domain.ChecklistItem, 0, len(rows))
	for i := range rows {
		result = append(result, mapChecklistItemModelToDomain(rows[i]))
	}

	return result, nil
}

func (r *ChecklistItemRepository) CountByTask(ctx context.Context, taskID uint) (int64, int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).
		Model(&checklistItemModel{}).
		Where("task_id = ?", taskID).
		Count(&total).Error; err != nil {
		return 0, 0, err
	}

	var done int64
	if err := r.db.WithContext(ctx).
		Model(&checklistItemModel{}).
		Where("task_id = ? AND is_done = ?", taskID, true).
		Count(&done).Error; err != nil {
		return 0, 0, err
	}

	return total, done, nil
}

func (r *ChecklistItemRepository) NextPosition(ctx context.Context, checklistID uint) (int, error) {
	var maxPosition sql.NullInt64

	if err := r.db.WithContext(ctx).
		Model(&checklistItemModel{}).
		Where("checklist_id = ?", checklistID).
		Select("MAX(position)").
		Scan(&maxPosition).Error; err != nil {
		return 0, err
	}

	if !maxPosition.Valid {
		return 1, nil
	}

	return int(maxPosition.Int64) + 1, nil
}

func mapChecklistItemModelToDomain(row checklistItemModel) *domain.ChecklistItem {
	return &domain.ChecklistItem{
		ID:          row.ID,
		ChecklistID: row.ChecklistID,
		TaskID:      row.TaskID,
		Title:       row.Title,
		IsDone:      row.IsDone,
		Position:    row.Position,
		CreatedBy:   row.CreatedBy,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}
