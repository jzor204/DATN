package usecase

import (
	"context"
	"fmt"
	"time"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

type ActivityUsecase struct {
	activityRepo interfaces.ActivityRepository
	taskRepo     interfaces.TaskRepository
	userRepo     interfaces.UserRepository
	access       *AccessService
	cacheService interfaces.CacheService
}

type RecordActivityInput struct {
	ProjectID uint
	TaskID    *uint
	ActorID   *uint
	Type      string
	Message   string
	Payload   map[string]interface{}
}

type ActivityOutput struct {
	ID        uint                   `json:"id"`
	ProjectID uint                   `json:"project_id"`
	TaskID    *uint                  `json:"task_id"`
	ActorID   *uint                  `json:"actor_id"`
	Actor     *UserReferenceOutput   `json:"actor,omitempty"`
	Type      string                 `json:"type"`
	Message   string                 `json:"message"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt time.Time              `json:"created_at"`
}

type activityListCacheEntry struct {
	Data  []ActivityOutput `json:"data"`
	Total int64            `json:"total"`
}

func NewActivityUsecase(
	activityRepo interfaces.ActivityRepository,
	taskRepo interfaces.TaskRepository,
	userRepo interfaces.UserRepository,
	access *AccessService,
	cacheService interfaces.CacheService,
) *ActivityUsecase {
	return &ActivityUsecase{
		activityRepo: activityRepo,
		taskRepo:     taskRepo,
		userRepo:     userRepo,
		access:       access,
		cacheService: cacheService,
	}
}

func (uc *ActivityUsecase) Record(ctx context.Context, input RecordActivityInput) (*ActivityOutput, error) {
	if input.ProjectID == 0 || input.Type == "" || input.Message == "" {
		return nil, nil
	}

	activity := &domain.Activity{
		ProjectID:   input.ProjectID,
		TaskID:      input.TaskID,
		ActorID:     input.ActorID,
		Type:        input.Type,
		Message:     input.Message,
		PayloadJSON: encodePayload(input.Payload),
	}

	if err := uc.activityRepo.Create(ctx, activity); err != nil {
		return nil, err
	}

	uc.invalidateActivityCaches(ctx, input.TaskID)
	return uc.toActivityOutput(ctx, activity), nil
}

func (uc *ActivityUsecase) ListByTask(
	ctx context.Context,
	actorID uint,
	globalRole string,
	taskID uint,
	page int,
	pageSize int,
) ([]ActivityOutput, int64, error) {
	task, err := uc.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, 0, err
	}
	if task == nil {
		return nil, 0, fmt.Errorf("task not found")
	}

	if err := uc.access.CanViewProject(ctx, task.ProjectID, actorID, globalRole); err != nil {
		return nil, 0, err
	}

	page, pageSize = normalizePagination(page, pageSize)
	cacheKey := fmt.Sprintf("task:%d:activities:page:%d:size:%d", taskID, page, pageSize)

	var cached activityListCacheEntry
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached.Data, cached.Total, nil
	}

	activities, total, err := uc.activityRepo.ListByTask(ctx, taskID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	result := make([]ActivityOutput, 0, len(activities))
	for _, activity := range activities {
		result = append(result, *uc.toActivityOutput(ctx, activity))
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, activityListCacheEntry{
		Data:  result,
		Total: total,
	}, readCacheTTL)

	return result, total, nil
}

func (uc *ActivityUsecase) invalidateActivityCaches(ctx context.Context, taskID *uint) {
	if taskID == nil {
		return
	}

	deleteCachePatterns(ctx, uc.cacheService, fmt.Sprintf("task:%d:activities:*", *taskID))
}

func (uc *ActivityUsecase) toActivityOutput(ctx context.Context, activity *domain.Activity) *ActivityOutput {
	var actor *UserReferenceOutput
	if activity.ActorID != nil {
		actor = uc.userReference(ctx, *activity.ActorID)
	}

	return &ActivityOutput{
		ID:        activity.ID,
		ProjectID: activity.ProjectID,
		TaskID:    activity.TaskID,
		ActorID:   activity.ActorID,
		Actor:     actor,
		Type:      activity.Type,
		Message:   activity.Message,
		Payload:   decodePayload(activity.PayloadJSON),
		CreatedAt: activity.CreatedAt,
	}
}

func (uc *ActivityUsecase) userReference(ctx context.Context, userID uint) *UserReferenceOutput {
	user, err := uc.userRepo.GetByID(ctx, userID)
	if err != nil || user == nil {
		return &UserReferenceOutput{
			ID:   userID,
			Name: fmt.Sprintf("User #%d", userID),
		}
	}

	return &UserReferenceOutput{
		ID:    user.ID,
		Name:  user.Name,
		Email: user.Email,
	}
}
