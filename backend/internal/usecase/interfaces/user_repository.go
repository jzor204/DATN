package interfaces

import (
	"context"
	"task-management/internal/domain"
)

type UserRepository interface {
	Create(ctx context.Context, user *domain.User) error
	GetByID(ctx context.Context, id uint) (*domain.User, error)
	GetByEmail(ctx context.Context, email string) (*domain.User, error)
	ListCandidatesForProject(ctx context.Context, projectID uint, query string, page int, pageSize int) ([]*domain.User, int64, error)
}
