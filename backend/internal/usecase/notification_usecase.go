package usecase

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

type NotificationUsecase struct {
	notificationRepo  interfaces.NotificationRepository
	changeRequestRepo interfaces.TaskChangeRequestRepository
	cacheService      interfaces.CacheService
}

type NotificationOutput struct {
	ID        uint                   `json:"id"`
	UserID    uint                   `json:"user_id"`
	ActorID   *uint                  `json:"actor_id"`
	Type      string                 `json:"type"`
	Title     string                 `json:"title"`
	Message   string                 `json:"message"`
	Payload   map[string]interface{} `json:"payload"`
	ReadAt    *time.Time             `json:"read_at"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

type notificationListCacheEntry struct {
	Data  []NotificationOutput `json:"data"`
	Total int64                `json:"total"`
}

func NewNotificationUsecase(
	notificationRepo interfaces.NotificationRepository,
	changeRequestRepo interfaces.TaskChangeRequestRepository,
	cacheService interfaces.CacheService,
) *NotificationUsecase {
	return &NotificationUsecase{
		notificationRepo:  notificationRepo,
		changeRequestRepo: changeRequestRepo,
		cacheService:      cacheService,
	}
}

func (uc *NotificationUsecase) ListByUser(
	ctx context.Context,
	userID uint,
	page int,
	pageSize int,
) ([]NotificationOutput, int64, error) {
	page, pageSize = normalizePagination(page, pageSize)
	cacheKey := fmt.Sprintf("user:%d:notifications:page:%d:size:%d", userID, page, pageSize)

	var cached notificationListCacheEntry
	if getCachedJSON(ctx, uc.cacheService, cacheKey, &cached) {
		return cached.Data, cached.Total, nil
	}

	notifications, total, err := uc.notificationRepo.ListByUser(ctx, userID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	result := make([]NotificationOutput, 0, len(notifications))
	for _, notification := range notifications {
		result = append(result, *uc.toNotificationOutput(ctx, notification))
	}

	setCachedJSON(ctx, uc.cacheService, cacheKey, notificationListCacheEntry{
		Data:  result,
		Total: total,
	}, readCacheTTL)

	return result, total, nil
}

func (uc *NotificationUsecase) MarkRead(ctx context.Context, userID uint, notificationID uint) error {
	if err := uc.notificationRepo.MarkRead(ctx, notificationID, userID); err != nil {
		return err
	}

	uc.invalidateNotificationCaches(ctx, userID)
	return nil
}

func (uc *NotificationUsecase) invalidateNotificationCaches(ctx context.Context, userID uint) {
	deleteCachePatterns(ctx, uc.cacheService, fmt.Sprintf("user:%d:notifications:*", userID))
}

func (uc *NotificationUsecase) toNotificationOutput(ctx context.Context, notification *domain.Notification) *NotificationOutput {
	payload := decodePayload(notification.PayloadJSON)

	if uc.changeRequestRepo != nil {
		if requestID := uintFromPayload(payload, "change_request_id"); requestID != 0 {
			if request, err := uc.changeRequestRepo.GetByID(ctx, requestID); err == nil && request != nil {
				payload["change_request_status"] = request.Status
			}
		}
	}

	return &NotificationOutput{
		ID:        notification.ID,
		UserID:    notification.UserID,
		ActorID:   notification.ActorID,
		Type:      notification.Type,
		Title:     notification.Title,
		Message:   notification.Message,
		Payload:   payload,
		ReadAt:    notification.ReadAt,
		CreatedAt: notification.CreatedAt,
		UpdatedAt: notification.UpdatedAt,
	}
}

func decodePayload(raw string) map[string]interface{} {
	payload := map[string]interface{}{}
	if raw == "" {
		return payload
	}

	_ = json.Unmarshal([]byte(raw), &payload)
	return payload
}

func encodePayload(payload map[string]interface{}) string {
	if payload == nil {
		return "{}"
	}

	raw, err := json.Marshal(payload)
	if err != nil {
		return "{}"
	}

	return string(raw)
}

func uintFromPayload(payload map[string]interface{}, key string) uint {
	raw, ok := payload[key]
	if !ok {
		return 0
	}

	switch value := raw.(type) {
	case float64:
		if value > 0 {
			return uint(value)
		}
	case int:
		if value > 0 {
			return uint(value)
		}
	case uint:
		return value
	case json.Number:
		parsed, err := value.Int64()
		if err == nil && parsed > 0 {
			return uint(parsed)
		}
	}

	return 0
}
