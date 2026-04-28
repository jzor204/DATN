package repository

import (
	"context"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

type userModel struct {
	ID           uint      `gorm:"column:id;primaryKey;autoIncrement"`
	Name         string    `gorm:"column:name;size:255;not null"`
	Email        string    `gorm:"column:email;size:255;not null;uniqueIndex"`
	PasswordHash string    `gorm:"column:password_hash;type:text;not null"`
	Role         string    `gorm:"column:role;size:50;not null"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

func (userModel) TableName() string {
	return "users"
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{
		db: db,
	}
}

func (r *UserRepository) Create(ctx context.Context, user *domain.User) error {
	model := &userModel{
		Name:         user.Name,
		Email:        user.Email,
		PasswordHash: user.PasswordHash,
		Role:         user.Role,
	}

	if err := r.db.WithContext(ctx).Create(model).Error; err != nil {
		return err
	}

	user.ID = model.ID
	user.CreatedAt = model.CreatedAt
	user.UpdatedAt = model.UpdatedAt

	return nil
}

func (r *UserRepository) GetByID(ctx context.Context, id uint) (*domain.User, error) {
	var model userModel

	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&model).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapUserModelToDomain(model), nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var model userModel

	err := r.db.WithContext(ctx).
		Where("email = ?", email).
		First(&model).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapUserModelToDomain(model), nil
}

func mapUserModelToDomain(model userModel) *domain.User {
	return &domain.User{
		ID:           model.ID,
		Name:         model.Name,
		Email:        model.Email,
		PasswordHash: model.PasswordHash,
		Role:         model.Role,
		CreatedAt:    model.CreatedAt,
		UpdatedAt:    model.UpdatedAt,
	}
}
