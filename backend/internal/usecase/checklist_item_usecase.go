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

type ChecklistItemUsecase struct {
	checklistRepo interfaces.ChecklistRepository
	itemRepo      interfaces.ChecklistItemRepository
	taskRepo      interfaces.TaskRepository
	accessService *AccessService
	cacheService  interfaces.CacheService
}

type CreateChecklistInput struct {
	Title string
}

type CreateChecklistItemInput struct {
	Title string
}

type UpdateChecklistItemInput struct {
	Title  *string
	IsDone *bool
}

type ChecklistOutput struct {
	ID        uint                  `json:"id"`
	TaskID    uint                  `json:"task_id"`
	Title     string                `json:"title"`
	Position  int                   `json:"position"`
	CreatedBy uint                  `json:"created_by"`
	CreatedAt time.Time             `json:"created_at"`
	UpdatedAt time.Time             `json:"updated_at"`
	Items     []ChecklistItemOutput `json:"items"`
}

type ChecklistItemOutput struct {
	ID          uint      `json:"id"`
	ChecklistID uint      `json:"checklist_id"`
	TaskID      uint      `json:"task_id"`
	Title       string    `json:"title"`
	IsDone      bool      `json:"is_done"`
	Position    int       `json:"position"`
	CreatedBy   uint      `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func NewChecklistItemUsecase(
	checklistRepo interfaces.ChecklistRepository,
	itemRepo interfaces.ChecklistItemRepository,
	taskRepo interfaces.TaskRepository,
	accessService *AccessService,
	cacheService interfaces.CacheService,
) *ChecklistItemUsecase {
	return &ChecklistItemUsecase{
		checklistRepo: checklistRepo,
		itemRepo:      itemRepo,
		taskRepo:      taskRepo,
		accessService: accessService,
		cacheService:  cacheService,
	}
}

func (uc *ChecklistItemUsecase) ListByTask(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
) ([]ChecklistOutput, error) {
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

	cacheKey := fmt.Sprintf("task:%d:checklists", taskID)
	var cached []ChecklistOutput
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached, nil
	}

	checklists, err := uc.checklistRepo.ListByTask(ctx, taskID)
	if err != nil {
		return nil, err
	}

	items, err := uc.itemRepo.ListByTask(ctx, taskID)
	if err != nil {
		return nil, err
	}

	itemsByChecklist := make(map[uint][]*domain.ChecklistItem)
	for _, item := range items {
		itemsByChecklist[item.ChecklistID] = append(itemsByChecklist[item.ChecklistID], item)
	}

	result := make([]ChecklistOutput, 0, len(checklists))
	for _, checklist := range checklists {
		checklist.Items = itemsByChecklist[checklist.ID]
		result = append(result, *toChecklistOutput(checklist))
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, result, readCacheTTL)

	return result, nil
}

func (uc *ChecklistItemUsecase) CreateChecklist(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
	input CreateChecklistInput,
) (*ChecklistOutput, error) {
	task, err := uc.getEditableTask(ctx, actorID, globalRole, taskID)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("checklist title is required")
	}

	position, err := uc.checklistRepo.NextPosition(ctx, task.ID)
	if err != nil {
		return nil, err
	}

	checklist := &domain.Checklist{
		TaskID:    task.ID,
		Title:     title,
		Position:  position,
		CreatedBy: actorID,
		Items:     []*domain.ChecklistItem{},
	}

	if err := uc.checklistRepo.Create(ctx, checklist); err != nil {
		return nil, err
	}

	uc.invalidateChecklistCaches(ctx, task.ID, task.ProjectID)

	return toChecklistOutput(checklist), nil
}

func (uc *ChecklistItemUsecase) DeleteChecklist(
	ctx context.Context,
	actorID uint,
	globalRole string,
	checklistID uint,
) (uint, int, error) {
	checklist, task, err := uc.getEditableChecklist(ctx, actorID, globalRole, checklistID)
	if err != nil {
		return 0, 0, err
	}

	if err := uc.checklistRepo.Delete(ctx, checklist.ID); err != nil {
		return 0, 0, err
	}

	progress, err := uc.recalculateTaskProgress(ctx, task.ID)
	if err != nil {
		return 0, 0, err
	}

	uc.invalidateChecklistCaches(ctx, task.ID, task.ProjectID)

	return task.ID, progress, nil
}

func (uc *ChecklistItemUsecase) CreateItem(
	ctx context.Context,
	actorID uint,
	globalRole string,
	checklistID uint,
	input CreateChecklistItemInput,
) (*ChecklistItemOutput, int, error) {
	checklist, task, err := uc.getEditableChecklist(ctx, actorID, globalRole, checklistID)
	if err != nil {
		return nil, 0, err
	}

	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, 0, errors.New("checklist item title is required")
	}

	position, err := uc.itemRepo.NextPosition(ctx, checklist.ID)
	if err != nil {
		return nil, 0, err
	}

	item := &domain.ChecklistItem{
		ChecklistID: checklist.ID,
		TaskID:      task.ID,
		Title:       title,
		IsDone:      false,
		Position:    position,
		CreatedBy:   actorID,
	}

	if err := uc.itemRepo.Create(ctx, item); err != nil {
		return nil, 0, err
	}

	progress, err := uc.recalculateTaskProgress(ctx, task.ID)
	if err != nil {
		return nil, 0, err
	}

	uc.invalidateChecklistCaches(ctx, task.ID, task.ProjectID)

	return toChecklistItemOutput(item), progress, nil
}

func (uc *ChecklistItemUsecase) Update(
	ctx context.Context,
	actorID uint,
	globalRole string,
	itemID uint,
	input UpdateChecklistItemInput,
) (*ChecklistItemOutput, int, error) {
	item, err := uc.itemRepo.GetByID(ctx, itemID)
	if err != nil {
		return nil, 0, err
	}
	if item == nil {
		return nil, 0, errors.New("checklist item not found")
	}

	task, err := uc.getEditableTask(ctx, actorID, globalRole, item.TaskID)
	if err != nil {
		return nil, 0, err
	}

	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return nil, 0, errors.New("checklist item title cannot be empty")
		}
		item.Title = title
	}

	if input.IsDone != nil {
		item.IsDone = *input.IsDone
	}

	if err := uc.itemRepo.Update(ctx, item); err != nil {
		return nil, 0, err
	}

	progress, err := uc.recalculateTaskProgress(ctx, task.ID)
	if err != nil {
		return nil, 0, err
	}

	uc.invalidateChecklistCaches(ctx, task.ID, task.ProjectID)

	return toChecklistItemOutput(item), progress, nil
}

func (uc *ChecklistItemUsecase) Delete(
	ctx context.Context,
	actorID uint,
	globalRole string,
	itemID uint,
) (uint, int, error) {
	item, err := uc.itemRepo.GetByID(ctx, itemID)
	if err != nil {
		return 0, 0, err
	}
	if item == nil {
		return 0, 0, errors.New("checklist item not found")
	}

	task, err := uc.getEditableTask(ctx, actorID, globalRole, item.TaskID)
	if err != nil {
		return 0, 0, err
	}

	if err := uc.itemRepo.Delete(ctx, itemID); err != nil {
		return 0, 0, err
	}

	progress, err := uc.recalculateTaskProgress(ctx, task.ID)
	if err != nil {
		return 0, 0, err
	}

	uc.invalidateChecklistCaches(ctx, task.ID, task.ProjectID)

	return task.ID, progress, nil
}

func (uc *ChecklistItemUsecase) invalidateChecklistCaches(ctx context.Context, taskID uint, projectID uint) {
	deleteCacheKeys(ctx, uc.cacheService, fmt.Sprintf("task:%d:detail", taskID))
	deleteCachePatterns(ctx, uc.cacheService,
		fmt.Sprintf("task:%d:checklists", taskID),
		fmt.Sprintf("project:%d:tasks:*", projectID),
		"user:*:tasks:*",
	)
}

func (uc *ChecklistItemUsecase) getEditableChecklist(
	ctx context.Context,
	actorID uint,
	globalRole string,
	checklistID uint,
) (*domain.Checklist, *domain.Task, error) {
	checklist, err := uc.checklistRepo.GetByID(ctx, checklistID)
	if err != nil {
		return nil, nil, err
	}
	if checklist == nil {
		return nil, nil, errors.New("checklist not found")
	}

	task, err := uc.getEditableTask(ctx, actorID, globalRole, checklist.TaskID)
	if err != nil {
		return nil, nil, err
	}

	return checklist, task, nil
}

func (uc *ChecklistItemUsecase) getEditableTask(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
) (*domain.Task, error) {
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
	isProjectMember := role == domain.ProjectRoleOwner ||
		role == domain.ProjectRoleAdmin ||
		role == domain.ProjectRoleMember

	if !isSystemAdmin && !isProjectMember {
		return nil, errors.New("forbidden: you are not a member of this project")
	}

	return task, nil
}

func (uc *ChecklistItemUsecase) recalculateTaskProgress(ctx context.Context, taskID uint) (int, error) {
	total, done, err := uc.itemRepo.CountByTask(ctx, taskID)
	if err != nil {
		return 0, err
	}

	progress := 0
	if total > 0 {
		progress = int((done*100 + total/2) / total)
	}

	if err := uc.taskRepo.UpdateProgress(ctx, taskID, progress); err != nil {
		return 0, err
	}

	return progress, nil
}

func toChecklistOutput(checklist *domain.Checklist) *ChecklistOutput {
	items := make([]ChecklistItemOutput, 0, len(checklist.Items))
	for _, item := range checklist.Items {
		items = append(items, *toChecklistItemOutput(item))
	}

	return &ChecklistOutput{
		ID:        checklist.ID,
		TaskID:    checklist.TaskID,
		Title:     checklist.Title,
		Position:  checklist.Position,
		CreatedBy: checklist.CreatedBy,
		CreatedAt: checklist.CreatedAt,
		UpdatedAt: checklist.UpdatedAt,
		Items:     items,
	}
}

func toChecklistItemOutput(item *domain.ChecklistItem) *ChecklistItemOutput {
	return &ChecklistItemOutput{
		ID:          item.ID,
		ChecklistID: item.ChecklistID,
		TaskID:      item.TaskID,
		Title:       item.Title,
		IsDone:      item.IsDone,
		Position:    item.Position,
		CreatedBy:   item.CreatedBy,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}
}
