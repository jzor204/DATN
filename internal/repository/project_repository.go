package repository

import (
	"context"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type ProjectRepository struct {
	db *gorm.DB
}

type projectModel struct {
	ID          uint      `gorm:"column:id;primaryKey;autoIncrement"`
	Name        string    `gorm:"column:name;size:255;not null"`
	Description string    `gorm:"column:description;type:text"`
	OwnerID     uint      `gorm:"column:owner_id;not null"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

func (projectModel) TableName() string {
	return "projects"
}

type projectMemberModel struct {
	ID            uint      `gorm:"column:id;primaryKey;autoIncrement"`
	ProjectID     uint      `gorm:"column:project_id;not null"`
	UserID        uint      `gorm:"column:user_id;not null"`
	RoleInProject string    `gorm:"column:role_in_project;size:50;not null"`
	CreatedAt     time.Time `gorm:"column:created_at"`
	UpdatedAt     time.Time `gorm:"column:updated_at"`
}

func (projectMemberModel) TableName() string {
	return "project_members"
}

func NewProjectRepository(db *gorm.DB) *ProjectRepository {
	return &ProjectRepository{
		db: db,
	}
}

func (r *ProjectRepository) CreateWithOwner(ctx context.Context, project *domain.Project, ownerMember *domain.ProjectMember) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		projectRow := &projectModel{
			Name:        project.Name,
			Description: project.Description,
			OwnerID:     project.OwnerID,
		}

		if err := tx.Create(projectRow).Error; err != nil {
			return err
		}

		memberRow := &projectMemberModel{
			ProjectID:     projectRow.ID,
			UserID:        ownerMember.UserID,
			RoleInProject: ownerMember.RoleInProject,
		}

		if err := tx.Create(memberRow).Error; err != nil {
			return err
		}

		project.ID = projectRow.ID
		project.CreatedAt = projectRow.CreatedAt
		project.UpdatedAt = projectRow.UpdatedAt

		ownerMember.ID = memberRow.ID
		ownerMember.ProjectID = memberRow.ProjectID
		ownerMember.CreatedAt = memberRow.CreatedAt
		ownerMember.UpdatedAt = memberRow.UpdatedAt

		return nil
	})
}

func (r *ProjectRepository) GetByID(ctx context.Context, id uint) (*domain.Project, error) {
	var row projectModel

	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapProjectModelToDomain(row), nil
}

func (r *ProjectRepository) Update(ctx context.Context, project *domain.Project) error {
	result := r.db.WithContext(ctx).
		Model(&projectModel{}).
		Where("id = ?", project.ID).
		Updates(map[string]interface{}{
			"name":        project.Name,
			"description": project.Description,
		})
	if result.Error != nil {
		return result.Error
	}

	refreshed, err := r.GetByID(ctx, project.ID)
	if err != nil {
		return err
	}
	if refreshed != nil {
		project.CreatedAt = refreshed.CreatedAt
		project.UpdatedAt = refreshed.UpdatedAt
	}

	return nil
}

func (r *ProjectRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).
		Delete(&projectModel{}, id).Error
}

func (r *ProjectRepository) ListAll(ctx context.Context, page int, pageSize int) ([]*domain.Project, int64, error) {
	var (
		rows  []projectModel
		total int64
	)

	if err := r.db.WithContext(ctx).Model(&projectModel{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).
		Order("id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.Project, 0, len(rows))
	for i := range rows {
		result = append(result, mapProjectModelToDomain(rows[i]))
	}

	return result, total, nil
}

func (r *ProjectRepository) ListByUser(ctx context.Context, userID uint, page int, pageSize int) ([]*domain.Project, int64, error) {
	var (
		rows  []projectModel
		total int64
	)

	countQuery := r.db.WithContext(ctx).
		Table("projects").
		Joins("JOIN project_members ON project_members.project_id = projects.id").
		Where("project_members.user_id = ?", userID)

	if err := countQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	dataQuery := r.db.WithContext(ctx).
		Table("projects").
		Select("projects.id, projects.name, projects.description, projects.owner_id, projects.created_at, projects.updated_at").
		Joins("JOIN project_members ON project_members.project_id = projects.id").
		Where("project_members.user_id = ?", userID).
		Order("projects.id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize)

	if err := dataQuery.Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.Project, 0, len(rows))
	for i := range rows {
		result = append(result, mapProjectModelToDomain(rows[i]))
	}

	return result, total, nil
}

func (r *ProjectRepository) GetMember(ctx context.Context, projectID uint, userID uint) (*domain.ProjectMember, error) {
	var row projectMemberModel

	err := r.db.WithContext(ctx).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return mapProjectMemberModelToDomain(row), nil
}

func (r *ProjectRepository) ListMembers(ctx context.Context, projectID uint, page int, pageSize int) ([]*domain.ProjectMember, int64, error) {
	var (
		rows  []projectMemberModel
		total int64
	)

	if err := r.db.WithContext(ctx).
		Model(&projectMemberModel{}).
		Where("project_id = ?", projectID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("id ASC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.ProjectMember, 0, len(rows))
	for i := range rows {
		result = append(result, mapProjectMemberModelToDomain(rows[i]))
	}

	return result, total, nil
}

func (r *ProjectRepository) AddMember(ctx context.Context, member *domain.ProjectMember) error {
	row := &projectMemberModel{
		ProjectID:     member.ProjectID,
		UserID:        member.UserID,
		RoleInProject: member.RoleInProject,
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	member.ID = row.ID
	member.CreatedAt = row.CreatedAt
	member.UpdatedAt = row.UpdatedAt

	return nil
}

func (r *ProjectRepository) RemoveMember(ctx context.Context, projectID uint, userID uint) error {
	return r.db.WithContext(ctx).
		Where("project_id = ? AND user_id = ?", projectID, userID).
		Delete(&projectMemberModel{}).Error
}

func mapProjectModelToDomain(row projectModel) *domain.Project {
	return &domain.Project{
		ID:          row.ID,
		Name:        row.Name,
		Description: row.Description,
		OwnerID:     row.OwnerID,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

func mapProjectMemberModelToDomain(row projectMemberModel) *domain.ProjectMember {
	return &domain.ProjectMember{
		ID:            row.ID,
		ProjectID:     row.ProjectID,
		UserID:        row.UserID,
		RoleInProject: row.RoleInProject,
		CreatedAt:     row.CreatedAt,
		UpdatedAt:     row.UpdatedAt,
	}
}
