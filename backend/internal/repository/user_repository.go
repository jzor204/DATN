package repository

import (
	"context"
	"errors"
	"strconv"
	"strings"
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

func (r *UserRepository) UpsertBootstrapAdmin(
	ctx context.Context,
	name string,
	email string,
	passwordHash string,
) (uint, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	var existing userModel
	err := r.db.WithContext(ctx).
		Where("email = ?", email).
		First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		model := &userModel{
			Name:         name,
			Email:        email,
			PasswordHash: passwordHash,
			Role:         domain.UserRoleAdmin,
		}
		if err := r.db.WithContext(ctx).Create(model).Error; err != nil {
			return 0, err
		}
		return model.ID, nil
	}

	if err := r.db.WithContext(ctx).
		Model(&userModel{}).
		Where("id = ?", existing.ID).
		Updates(map[string]interface{}{
			"name":          name,
			"password_hash": passwordHash,
			"role":          domain.UserRoleAdmin,
		}).Error; err != nil {
		return 0, err
	}

	return existing.ID, nil
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

func (r *UserRepository) ListCandidatesForProject(
	ctx context.Context,
	projectID uint,
	query string,
	page int,
	pageSize int,
) ([]*domain.User, int64, error) {
	var (
		rows  []userModel
		total int64
	)

	keyword := strings.ToLower(strings.TrimSpace(query))

	buildQuery := func() *gorm.DB {
		db := r.db.WithContext(ctx).
			Model(&userModel{}).
			Joins(
				"LEFT JOIN project_members ON project_members.user_id = users.id AND project_members.project_id = ?",
				projectID,
			).
			Where("project_members.id IS NULL")

		if keyword != "" {
			like := "%" + keyword + "%"
			conditions := r.db.Where("LOWER(users.name) LIKE ? OR LOWER(users.email) LIKE ?", like, like)

			if parsedID, err := strconv.ParseUint(keyword, 10, 64); err == nil {
				conditions = conditions.Or("users.id = ?", uint(parsedID))
			}

			db = db.Where(conditions)
		}

		return db
	}

	if err := buildQuery().Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := buildQuery().
		Select("users.*").
		Order("users.id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.User, 0, len(rows))
	for i := range rows {
		result = append(result, mapUserModelToDomain(rows[i]))
	}

	return result, total, nil
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
