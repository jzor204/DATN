package usecase

import (
	"context"
	"errors"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

type AccessService struct {
	projectRepo interfaces.ProjectRepository
}

func NewAccessService(projectRepo interfaces.ProjectRepository) *AccessService {
	return &AccessService{
		projectRepo: projectRepo,
	}
}

func (s *AccessService) GetProjectRole(ctx context.Context, projectID uint, userID uint, globalRole string) (string, error) {
	if globalRole == domain.UserRoleAdmin {
		return domain.ProjectRoleOwner, nil
	}

	member, err := s.projectRepo.GetMember(ctx, projectID, userID)
	if err != nil {
		return "", err
	}
	if member == nil {
		return "", errors.New("forbidden: you are not a member of this project")
	}

	return member.RoleInProject, nil
}

func (s *AccessService) CanViewProject(ctx context.Context, projectID uint, userID uint, globalRole string) error {
	if globalRole == domain.UserRoleAdmin {
		return nil
	}

	member, err := s.projectRepo.GetMember(ctx, projectID, userID)
	if err != nil {
		return err
	}
	if member == nil {
		return errors.New("forbidden: you are not a member of this project")
	}

	return nil
}

func (s *AccessService) CanManageProject(ctx context.Context, projectID uint, userID uint, globalRole string) error {
	if globalRole == domain.UserRoleAdmin {
		return nil
	}

	role, err := s.GetProjectRole(ctx, projectID, userID, globalRole)
	if err != nil {
		return err
	}

	if role != domain.ProjectRoleOwner && role != domain.ProjectRoleAdmin {
		return errors.New("forbidden: you do not have permission to manage this project")
	}

	return nil
}

func (s *AccessService) CanDeleteProject(ctx context.Context, projectID uint, userID uint, globalRole string) error {
	if globalRole == domain.UserRoleAdmin {
		return nil
	}

	role, err := s.GetProjectRole(ctx, projectID, userID, globalRole)
	if err != nil {
		return err
	}

	if role != domain.ProjectRoleOwner {
		return errors.New("forbidden: only owner can delete this project")
	}

	return nil
}

func (s *AccessService) CanManageMembers(ctx context.Context, projectID uint, userID uint, globalRole string) error {
	if globalRole == domain.UserRoleAdmin {
		return nil
	}

	role, err := s.GetProjectRole(ctx, projectID, userID, globalRole)
	if err != nil {
		return err
	}

	if role != domain.ProjectRoleOwner && role != domain.ProjectRoleAdmin {
		return errors.New("forbidden: you do not have permission to manage project members")
	}

	return nil
}
