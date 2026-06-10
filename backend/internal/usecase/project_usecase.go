package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

type ProjectUsecase struct {
	projectRepo   interfaces.ProjectRepository
	userRepo      interfaces.UserRepository
	accessService *AccessService
	cacheService  interfaces.CacheService
}

type CreateProjectInput struct {
	Name        string
	Description string
}

type UpdateProjectInput struct {
	Name        string
	Description string
}

type AddProjectMemberInput struct {
	UserID        uint
	RoleInProject string
}

type ProjectOutput struct {
	ID          uint      `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	OwnerID     uint      `json:"owner_id"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProjectMemberOutput struct {
	UserID        uint      `json:"user_id"`
	Name          string    `json:"name"`
	Email         string    `json:"email"`
	RoleInProject string    `json:"role_in_project"`
	JoinedAt      time.Time `json:"joined_at"`
}

type ProjectMemberCandidateOutput struct {
	UserID    uint      `json:"user_id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type projectListCacheEntry struct {
	Data  []ProjectOutput `json:"data"`
	Total int64           `json:"total"`
}

type projectMemberListCacheEntry struct {
	Data  []ProjectMemberOutput `json:"data"`
	Total int64                 `json:"total"`
}

type projectMemberCandidateListCacheEntry struct {
	Data  []ProjectMemberCandidateOutput `json:"data"`
	Total int64                          `json:"total"`
}

func NewProjectUsecase(
	projectRepo interfaces.ProjectRepository,
	userRepo interfaces.UserRepository,
	accessService *AccessService,
	cacheService interfaces.CacheService,
) *ProjectUsecase {
	return &ProjectUsecase{
		projectRepo:   projectRepo,
		userRepo:      userRepo,
		accessService: accessService,
		cacheService:  cacheService,
	}
}

func (uc *ProjectUsecase) Create(
	ctx context.Context,
	actorID uint,
	input CreateProjectInput,
) (*ProjectOutput, error) {
	name := strings.TrimSpace(input.Name)
	description := strings.TrimSpace(input.Description)

	if actorID == 0 {
		return nil, errors.New("invalid user id")
	}
	if name == "" {
		return nil, errors.New("project name is required")
	}

	project := &domain.Project{
		Name:        name,
		Description: description,
		OwnerID:     actorID,
	}

	ownerMember := &domain.ProjectMember{
		UserID:        actorID,
		RoleInProject: domain.ProjectRoleOwner,
	}

	if err := uc.projectRepo.CreateWithOwner(ctx, project, ownerMember); err != nil {
		return nil, err
	}

	uc.invalidateProjectCaches(ctx, project.ID)
	deleteCachePatterns(ctx, uc.cacheService, "projects:list:*")

	return toProjectOutput(project), nil
}

func (uc *ProjectUsecase) List(
	ctx context.Context,
	actorID uint,
	globalRole string,
	page int,
	pageSize int,
) ([]ProjectOutput, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	cacheKey := fmt.Sprintf("projects:list:user:%d:role:%s:page:%d:size:%d", actorID, globalRole, page, pageSize)

	var cached projectListCacheEntry
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached.Data, cached.Total, nil
	}

	var (
		projects []*domain.Project
		total    int64
		err      error
	)

	if globalRole == domain.UserRoleAdmin {
		projects, total, err = uc.projectRepo.ListAll(ctx, page, pageSize)
	} else {
		projects, total, err = uc.projectRepo.ListByUser(ctx, actorID, page, pageSize)
	}
	if err != nil {
		return nil, 0, err
	}

	result := make([]ProjectOutput, 0, len(projects))
	for _, project := range projects {
		result = append(result, *toProjectOutput(project))
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, projectListCacheEntry{
		Data:  result,
		Total: total,
	}, readCacheTTL)

	return result, total, nil
}

func (uc *ProjectUsecase) GetByID(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
) (*ProjectOutput, error) {
	cacheKey := fmt.Sprintf("project:%d:detail", projectID)
	var cached ProjectOutput
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		if err := uc.accessService.CanViewProject(ctx, projectID, actorID, globalRole); err != nil {
			return nil, err
		}
		return &cached, nil
	}

	project, err := uc.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, errors.New("project not found")
	}

	if err := uc.accessService.CanViewProject(ctx, projectID, actorID, globalRole); err != nil {
		return nil, err
	}

	output := toProjectOutput(project)
	setCachedJSON(ctx, uc.cacheService, cacheKey, output, readCacheTTL)

	return output, nil
}

func (uc *ProjectUsecase) Update(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
	input UpdateProjectInput,
) (*ProjectOutput, error) {
	project, err := uc.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, errors.New("project not found")
	}

	if err := uc.accessService.CanManageProject(ctx, projectID, actorID, globalRole); err != nil {
		return nil, err
	}

	name := strings.TrimSpace(input.Name)
	description := strings.TrimSpace(input.Description)

	if name == "" {
		return nil, errors.New("project name is required")
	}

	project.Name = name
	project.Description = description

	if err := uc.projectRepo.Update(ctx, project); err != nil {
		return nil, err
	}

	uc.invalidateProjectCaches(ctx, projectID)

	return toProjectOutput(project), nil
}

func (uc *ProjectUsecase) Delete(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
) error {
	project, err := uc.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return err
	}
	if project == nil {
		return errors.New("project not found")
	}

	if err := uc.accessService.CanDeleteProject(ctx, projectID, actorID, globalRole); err != nil {
		return err
	}

	if err := uc.projectRepo.Delete(ctx, projectID); err != nil {
		return err
	}

	uc.invalidateProjectCaches(ctx, projectID)
	return nil
}

func (uc *ProjectUsecase) ListMembers(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
	page int,
	pageSize int,
) ([]ProjectMemberOutput, int64, error) {
	project, err := uc.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, 0, err
	}
	if project == nil {
		return nil, 0, errors.New("project not found")
	}

	if err := uc.accessService.CanViewProject(ctx, projectID, actorID, globalRole); err != nil {
		return nil, 0, err
	}

	page, pageSize = normalizePagination(page, pageSize)
	cacheKey := fmt.Sprintf("project:%d:members:page:%d:size:%d", projectID, page, pageSize)

	var cached projectMemberListCacheEntry
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached.Data, cached.Total, nil
	}

	members, total, err := uc.projectRepo.ListMembers(ctx, projectID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	result := make([]ProjectMemberOutput, 0, len(members))
	for _, member := range members {
		user, err := uc.userRepo.GetByID(ctx, member.UserID)
		if err != nil {
			return nil, 0, err
		}
		if user == nil {
			continue
		}

		result = append(result, ProjectMemberOutput{
			UserID:        user.ID,
			Name:          user.Name,
			Email:         user.Email,
			RoleInProject: member.RoleInProject,
			JoinedAt:      member.CreatedAt,
		})
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, projectMemberListCacheEntry{
		Data:  result,
		Total: total,
	}, readCacheTTL)

	return result, total, nil
}

func (uc *ProjectUsecase) ListMemberCandidates(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
	query string,
	page int,
	pageSize int,
) ([]ProjectMemberCandidateOutput, int64, error) {
	project, err := uc.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, 0, err
	}
	if project == nil {
		return nil, 0, errors.New("project not found")
	}

	if err := uc.accessService.CanManageMembers(ctx, projectID, actorID, globalRole); err != nil {
		return nil, 0, err
	}

	page, pageSize = normalizePagination(page, pageSize)
	normalizedQuery := strings.TrimSpace(query)
	cacheKey := fmt.Sprintf("project:%d:candidates:q:%s:page:%d:size:%d", projectID, normalizedQuery, page, pageSize)

	var cached projectMemberCandidateListCacheEntry
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached.Data, cached.Total, nil
	}

	users, total, err := uc.userRepo.ListCandidatesForProject(
		ctx,
		projectID,
		normalizedQuery,
		page,
		pageSize,
	)
	if err != nil {
		return nil, 0, err
	}

	result := make([]ProjectMemberCandidateOutput, 0, len(users))
	for _, user := range users {
		result = append(result, ProjectMemberCandidateOutput{
			UserID:    user.ID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
		})
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, projectMemberCandidateListCacheEntry{
		Data:  result,
		Total: total,
	}, readCacheTTL)

	return result, total, nil
}

func (uc *ProjectUsecase) AddMember(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
	input AddProjectMemberInput,
) (*ProjectMemberOutput, error) {
	project, err := uc.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, errors.New("project not found")
	}

	if err := uc.accessService.CanManageMembers(ctx, projectID, actorID, globalRole); err != nil {
		return nil, err
	}

	if input.UserID == 0 {
		return nil, errors.New("user_id is required")
	}

	roleInProject := strings.ToLower(strings.TrimSpace(input.RoleInProject))
	if roleInProject != domain.ProjectRoleAdmin && roleInProject != domain.ProjectRoleMember {
		return nil, errors.New("role_in_project must be admin or member")
	}

	user, err := uc.userRepo.GetByID(ctx, input.UserID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	existingMember, err := uc.projectRepo.GetMember(ctx, projectID, input.UserID)
	if err != nil {
		return nil, err
	}
	if existingMember != nil {
		return nil, errors.New("user is already a member of this project")
	}

	member := &domain.ProjectMember{
		ProjectID:     projectID,
		UserID:        input.UserID,
		RoleInProject: roleInProject,
	}

	if err := uc.projectRepo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	uc.invalidateProjectCaches(ctx, projectID)

	return &ProjectMemberOutput{
		UserID:        user.ID,
		Name:          user.Name,
		Email:         user.Email,
		RoleInProject: member.RoleInProject,
		JoinedAt:      member.CreatedAt,
	}, nil
}

func (uc *ProjectUsecase) RemoveMember(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
	targetUserID uint,
) error {
	project, err := uc.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return err
	}
	if project == nil {
		return errors.New("project not found")
	}

	if err := uc.accessService.CanManageMembers(ctx, projectID, actorID, globalRole); err != nil {
		return err
	}

	if targetUserID == 0 {
		return errors.New("invalid target user id")
	}

	if actorID == targetUserID {
		return errors.New("you cannot remove yourself from the project")
	}

	member, err := uc.projectRepo.GetMember(ctx, projectID, targetUserID)
	if err != nil {
		return err
	}
	if member == nil {
		return errors.New("project member not found")
	}

	if member.RoleInProject == domain.ProjectRoleOwner {
		return errors.New("cannot remove project owner")
	}

	if err := uc.projectRepo.RemoveMember(ctx, projectID, targetUserID); err != nil {
		return err
	}

	uc.invalidateProjectCaches(ctx, projectID)
	return nil
}

func (uc *ProjectUsecase) invalidateProjectCaches(ctx context.Context, projectID uint) {
	deleteCacheKeys(ctx, uc.cacheService, fmt.Sprintf("project:%d:detail", projectID))
	deleteCachePatterns(ctx, uc.cacheService,
		"projects:list:*",
		fmt.Sprintf("project:%d:members:*", projectID),
		fmt.Sprintf("project:%d:candidates:*", projectID),
		fmt.Sprintf("project:%d:tasks:*", projectID),
		"user:*:tasks:*",
	)
}

func normalizePagination(page int, pageSize int) (int, int) {
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func toProjectOutput(project *domain.Project) *ProjectOutput {
	return &ProjectOutput{
		ID:          project.ID,
		Name:        project.Name,
		Description: project.Description,
		OwnerID:     project.OwnerID,
		CreatedAt:   project.CreatedAt,
		UpdatedAt:   project.UpdatedAt,
	}
}
