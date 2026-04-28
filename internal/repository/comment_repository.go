package repository

import (
	"context"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type CommentRepository struct {
	db *gorm.DB
}

type commentModel struct {
	ID        uint      `gorm:"column:id;primaryKey;autoIncrement"`
	TaskID    uint      `gorm:"column:task_id;not null"`
	AuthorID  uint      `gorm:"column:author_id;not null"`
	Content   string    `gorm:"column:content;type:text;not null"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (commentModel) TableName() string {
	return "comments"
}

func NewCommentRepository(db *gorm.DB) *CommentRepository {
	return &CommentRepository{db: db}
}

func (r *CommentRepository) Create(ctx context.Context, comment *domain.Comment) error {
	row := &commentModel{
		TaskID:   comment.TaskID,
		AuthorID: comment.AuthorID,
		Content:  comment.Content,
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	comment.ID = row.ID
	comment.CreatedAt = row.CreatedAt
	comment.UpdatedAt = row.UpdatedAt
	return nil
}

func (r *CommentRepository) GetByID(ctx context.Context, id uint) (*domain.Comment, error) {
	var row commentModel

	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapCommentModelToDomain(row), nil
}

func (r *CommentRepository) Update(ctx context.Context, comment *domain.Comment) error {
	result := r.db.WithContext(ctx).
		Model(&commentModel{}).
		Where("id = ?", comment.ID).
		Update("content", comment.Content)
	if result.Error != nil {
		return result.Error
	}

	refreshed, err := r.GetByID(ctx, comment.ID)
	if err != nil {
		return err
	}
	if refreshed != nil {
		comment.CreatedAt = refreshed.CreatedAt
		comment.UpdatedAt = refreshed.UpdatedAt
	}

	return nil
}

func (r *CommentRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&commentModel{}, id).Error
}

func (r *CommentRepository) ListByTask(
	ctx context.Context,
	taskID uint,
	page int,
	pageSize int,
) ([]*domain.Comment, int64, error) {
	var (
		rows  []commentModel
		total int64
	)

	if err := r.db.WithContext(ctx).
		Model(&commentModel{}).
		Where("task_id = ?", taskID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).
		Where("task_id = ?", taskID).
		Order("id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.Comment, 0, len(rows))
	for i := range rows {
		result = append(result, mapCommentModelToDomain(rows[i]))
	}

	return result, total, nil
}

func mapCommentModelToDomain(row commentModel) *domain.Comment {
	return &domain.Comment{
		ID:        row.ID,
		TaskID:    row.TaskID,
		AuthorID:  row.AuthorID,
		Content:   row.Content,
		CreatedAt: row.CreatedAt,
		UpdatedAt: row.UpdatedAt,
	}
}
