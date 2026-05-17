package usecase

import (
	"context"
	"errors"
	"strings"
	"time"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

type TaskUsecase struct {
	taskRepo      interfaces.TaskRepository
	projectRepo   interfaces.ProjectRepository
	userRepo      interfaces.UserRepository
	accessService *AccessService
}

type CreateTaskInput struct {
	Title       string
	Description string
	AssigneeID  *uint
}

type UpdateTaskInput struct {
	Title       *string
	Description *string
	Status      *string
	AssigneeID  *uint
}

type TaskOutput struct {
	ID          uint      `json:"id"`
	ProjectID   uint      `json:"project_id"`
	ProjectName string    `json:"project_name,omitempty"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Status      string    `json:"status"`
	AssigneeID  *uint     `json:"assignee_id"`
	CreatedBy   uint      `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ListMyTasksInput struct {
	ProjectID *uint
	Status    string
	Page      int
	PageSize  int
}

func NewTaskUsecase(
	taskRepo interfaces.TaskRepository,
	projectRepo interfaces.ProjectRepository,
	userRepo interfaces.UserRepository,
	accessService *AccessService,
) *TaskUsecase {
	return &TaskUsecase{
		taskRepo:      taskRepo,
		projectRepo:   projectRepo,
		userRepo:      userRepo,
		accessService: accessService,
	}
}

func (uc *TaskUsecase) Create(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
	input CreateTaskInput,
) (*TaskOutput, error) {
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

	title := strings.TrimSpace(input.Title)
	description := strings.TrimSpace(input.Description)

	if title == "" {
		return nil, errors.New("task title is required")
	}

	if input.AssigneeID != nil {
		user, err := uc.userRepo.GetByID(ctx, *input.AssigneeID)
		if err != nil {
			return nil, err
		}
		if user == nil {
			return nil, errors.New("assignee not found")
		}

		member, err := uc.projectRepo.GetMember(ctx, projectID, *input.AssigneeID)
		if err != nil {
			return nil, err
		}
		if member == nil {
			return nil, errors.New("assignee must be a member of this project")
		}
	}

	task := &domain.Task{
		ProjectID:   projectID,
		Title:       title,
		Description: description,
		Status:      domain.TaskStatusTodo,
		AssigneeID:  input.AssigneeID,
		CreatedBy:   actorID,
	}

	if err := uc.taskRepo.Create(ctx, task); err != nil {
		return nil, err
	}

	return toTaskOutput(task), nil
}

func (uc *TaskUsecase) ListByProject(
	ctx context.Context,
	actorID uint,
	globalRole string,
	projectID uint,
	page int,
	pageSize int,
) ([]TaskOutput, int64, error) {
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

	tasks, total, err := uc.taskRepo.ListByProject(ctx, projectID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	result := make([]TaskOutput, 0, len(tasks))
	for _, task := range tasks {
		result = append(result, *toTaskOutput(task))
	}

	return result, total, nil
}

func (uc *TaskUsecase) ListAssignedToUser(
	ctx context.Context,
	actorID uint,
	globalRole string,
	input ListMyTasksInput,
) ([]TaskOutput, int64, error) {
	page, pageSize := normalizePagination(input.Page, input.PageSize)

	status := strings.TrimSpace(input.Status)
	if status != "" {
		status = normalizeTaskStatus(status)
		if !isValidTaskStatus(status) {
			return nil, 0, errors.New("invalid task status")
		}
	}

	if input.ProjectID != nil {
		project, err := uc.projectRepo.GetByID(ctx, *input.ProjectID)
		if err != nil {
			return nil, 0, err
		}
		if project == nil {
			return nil, 0, errors.New("project not found")
		}

		if err := uc.accessService.CanViewProject(ctx, *input.ProjectID, actorID, globalRole); err != nil {
			return nil, 0, err
		}
	}

	requireMembership := globalRole != domain.UserRoleAdmin
	tasks, total, err := uc.taskRepo.ListAssignedToUser(
		ctx,
		actorID,
		input.ProjectID,
		status,
		requireMembership,
		page,
		pageSize,
	)
	if err != nil {
		return nil, 0, err
	}

	projectNames := make(map[uint]string)
	result := make([]TaskOutput, 0, len(tasks))
	for _, task := range tasks {
		output := *toTaskOutput(task)

		projectName, ok := projectNames[task.ProjectID]
		if !ok {
			project, err := uc.projectRepo.GetByID(ctx, task.ProjectID)
			if err != nil {
				return nil, 0, err
			}
			if project != nil {
				projectName = project.Name
			}
			projectNames[task.ProjectID] = projectName
		}

		output.ProjectName = projectName
		result = append(result, output)
	}

	return result, total, nil
}

func (uc *TaskUsecase) GetByID(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
) (*TaskOutput, error) {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}

	if err := uc.accessService.CanViewProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
		return nil, err
	}

	return toTaskOutput(task), nil
}

func (uc *TaskUsecase) Update(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
	input UpdateTaskInput,
) (*TaskOutput, error) {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, errors.New("task not found")
	}

	role, err := uc.accessService.GetProjectRole(ctx, task.ProjectID, actorID, globalRole)
	if err != nil {
		return nil, err
	}

	isSystemAdmin := globalRole == domain.UserRoleAdmin
	isProjectManager := role == domain.ProjectRoleOwner || role == domain.ProjectRoleAdmin

	if !isSystemAdmin && !isProjectManager {
		if task.AssigneeID == nil || *task.AssigneeID != actorID {
			return nil, errors.New("forbidden: you can only update tasks assigned to you")
		}

		if input.Title != nil || input.Description != nil || input.AssigneeID != nil {
			return nil, errors.New("forbidden: member can only update task status")
		}

		if input.Status == nil {
			return nil, errors.New("status is required")
		}

		status := normalizeTaskStatus(*input.Status)
		if !isValidTaskStatus(status) {
			return nil, errors.New("invalid task status")
		}

		task.Status = status

		if err := uc.taskRepo.Update(ctx, task); err != nil {
			return nil, err
		}

		return toTaskOutput(task), nil
	}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return nil, errors.New("task title cannot be empty")
		}
		task.Title = title
	}

	if input.Description != nil {
		task.Description = strings.TrimSpace(*input.Description)
	}

	if input.Status != nil {
		status := normalizeTaskStatus(*input.Status)
		if !isValidTaskStatus(status) {
			return nil, errors.New("invalid task status")
		}
		task.Status = status
	}

	if input.AssigneeID != nil {
		user, err := uc.userRepo.GetByID(ctx, *input.AssigneeID)
		if err != nil {
			return nil, err
		}
		if user == nil {
			return nil, errors.New("assignee not found")
		}

		member, err := uc.projectRepo.GetMember(ctx, task.ProjectID, *input.AssigneeID)
		if err != nil {
			return nil, err
		}
		if member == nil {
			return nil, errors.New("assignee must be a member of this project")
		}

		task.AssigneeID = input.AssigneeID
	}

	if err := uc.taskRepo.Update(ctx, task); err != nil {
		return nil, err
	}

	return toTaskOutput(task), nil
}

func (uc *TaskUsecase) Delete(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
) error {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return err
	}
	if task == nil {
		return errors.New("task not found")
	}

	if err := uc.accessService.CanManageProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
		return err
	}

	return uc.taskRepo.Delete(ctx, taskID)
}

func toTaskOutput(task *domain.Task) *TaskOutput {
	return &TaskOutput{
		ID:          task.ID,
		ProjectID:   task.ProjectID,
		Title:       task.Title,
		Description: task.Description,
		Status:      task.Status,
		AssigneeID:  task.AssigneeID,
		CreatedBy:   task.CreatedBy,
		CreatedAt:   task.CreatedAt,
		UpdatedAt:   task.UpdatedAt,
	}
}

func normalizeTaskStatus(status string) string {
	status = strings.ToLower(strings.TrimSpace(status))
	if status == "in-progress" {
		return domain.TaskStatusInProgress
	}
	return status
}

func isValidTaskStatus(status string) bool {
	return status == domain.TaskStatusTodo ||
		status == domain.TaskStatusInProgress ||
		status == domain.TaskStatusDone
}
