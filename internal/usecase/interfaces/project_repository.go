package interfaces

import (
	"context"
	"task-management/internal/domain"
)

type ProjectRepository interface {
	CreateWithOwner(ctx context.Context, project *domain.Project, ownerMember *domain.ProjectMember) error
	GetByID(ctx context.Context, id uint) (*domain.Project, error)
	Update(ctx context.Context, project *domain.Project) error
	Delete(ctx context.Context, id uint) error

	ListAll(ctx context.Context, page int, pageSize int) ([]*domain.Project, int64, error)
	ListByUser(ctx context.Context, userID uint, page int, pageSize int) ([]*domain.Project, int64, error)

	GetMember(ctx context.Context, projectID uint, userID uint) (*domain.ProjectMember, error)
	ListMembers(ctx context.Context, projectID uint, page int, pageSize int) ([]*domain.ProjectMember, int64, error)
	AddMember(ctx context.Context, member *domain.ProjectMember) error
	RemoveMember(ctx context.Context, projectID uint, userID uint) error
}
