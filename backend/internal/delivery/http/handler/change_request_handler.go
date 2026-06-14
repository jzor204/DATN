package handler

import (
	"task-management/internal/delivery/http/realtime"
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type ChangeRequestHandler struct {
	changeRequestUsecase *usecase.TaskChangeRequestUsecase
	realtimeHub          *realtime.Hub
}

func NewChangeRequestHandler(
	changeRequestUsecase *usecase.TaskChangeRequestUsecase,
	realtimeHub *realtime.Hub,
) *ChangeRequestHandler {
	return &ChangeRequestHandler{
		changeRequestUsecase: changeRequestUsecase,
		realtimeHub:          realtimeHub,
	}
}

func (h *ChangeRequestHandler) ListByTask(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	page, pageSize := getPagination(c)
	result, total, err := h.changeRequestUsecase.ListByTask(c.UserContext(), userID, globalRole, taskID, page, pageSize)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get change requests failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get change requests success", fiber.Map{
		"data": result,
		"pagination": dto.PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: calculateTotalPages(total, pageSize),
		},
	})
}

func (h *ChangeRequestHandler) GetByID(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	requestID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid change request id", err.Error())
	}

	result, err := h.changeRequestUsecase.GetByID(c.UserContext(), userID, globalRole, requestID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get change request failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get change request success", result)
}

func (h *ChangeRequestHandler) CreateForTask(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	var req dto.CreateTaskChangeRequestRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.changeRequestUsecase.Create(
		c.UserContext(),
		userID,
		globalRole,
		taskID,
		usecase.CreateTaskChangeRequestInput{
			Title:       req.Title,
			Description: req.Description,
			Status:      req.Status,
			Priority:    req.Priority,
			AssigneeIDs: usecase.OptionalUintSliceInput{
				Set:    req.AssigneeIDs.Set,
				Values: req.AssigneeIDs.Values,
			},
			Deadline: usecase.OptionalTimeInput{
				Set:   req.Deadline.Set,
				Value: req.Deadline.Value,
			},
			ReminderAt: usecase.OptionalTimeInput{
				Set:   req.ReminderAt.Set,
				Value: req.ReminderAt.Value,
			},
			Reason: req.Reason,
		},
	)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "create change request failed", err.Error())
	}

	h.broadcastNotifications("notification.created", userID, result.Notifications)
	h.broadcastChangeRequestChanged("change_request.created", userID, result.Request.ProjectID, result.Request.TaskID)

	return utils.Success(c, fiber.StatusCreated, "create change request success", result)
}

func (h *ChangeRequestHandler) Approve(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	requestID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid change request id", err.Error())
	}

	var req dto.ReviewTaskChangeRequestRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
		}
	}

	result, err := h.changeRequestUsecase.Approve(c.UserContext(), userID, globalRole, requestID, usecase.ReviewTaskChangeRequestInput{
		ReviewNote: req.ReviewNote,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "approve change request failed", err.Error())
	}

	h.broadcastNotifications("notification.created", userID, result.Notifications)
	h.broadcastNotificationUpdate(userID, result.Request.ProjectID)
	h.broadcastChangeRequestChanged("change_request.approved", userID, result.Request.ProjectID, result.Request.TaskID)
	if result.Task != nil {
		h.broadcastTaskUpdated(userID, result.Task.ProjectID, result.Task.ID)
	}

	return utils.Success(c, fiber.StatusOK, "approve change request success", result)
}

func (h *ChangeRequestHandler) Reject(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	requestID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid change request id", err.Error())
	}

	var req dto.ReviewTaskChangeRequestRequest
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&req); err != nil {
			return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
		}
	}

	result, err := h.changeRequestUsecase.Reject(c.UserContext(), userID, globalRole, requestID, usecase.ReviewTaskChangeRequestInput{
		ReviewNote: req.ReviewNote,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "reject change request failed", err.Error())
	}

	h.broadcastNotifications("notification.created", userID, result.Notifications)
	h.broadcastNotificationUpdate(userID, result.Request.ProjectID)
	h.broadcastChangeRequestChanged("change_request.rejected", userID, result.Request.ProjectID, result.Request.TaskID)

	return utils.Success(c, fiber.StatusOK, "reject change request success", result)
}

func (h *ChangeRequestHandler) Cancel(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	requestID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid change request id", err.Error())
	}

	result, err := h.changeRequestUsecase.Cancel(c.UserContext(), userID, globalRole, requestID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "cancel change request failed", err.Error())
	}

	h.broadcastNotifications("notification.created", userID, result.Notifications)
	h.broadcastNotificationUpdate(userID, result.Request.ProjectID)
	h.broadcastChangeRequestChanged("change_request.cancelled", userID, result.Request.ProjectID, result.Request.TaskID)

	return utils.Success(c, fiber.StatusOK, "cancel change request success", result)
}

func (h *ChangeRequestHandler) broadcastNotifications(eventType string, triggeredBy uint, notifications []usecase.NotificationOutput) {
	if h.realtimeHub == nil {
		return
	}

	for _, notification := range notifications {
		event := realtime.NewEvent(eventType, "notifications", 0, 0, triggeredBy)
		h.realtimeHub.Broadcast(event, realtime.UserRoom(notification.UserID))
	}
}

func (h *ChangeRequestHandler) broadcastNotificationUpdate(triggeredBy uint, projectID uint) {
	if h.realtimeHub == nil {
		return
	}

	event := realtime.NewEvent("notification.updated", "notifications", projectID, 0, triggeredBy)
	h.realtimeHub.Broadcast(event, realtime.ProjectRoom(projectID))
}

func (h *ChangeRequestHandler) broadcastTaskUpdated(triggeredBy uint, projectID uint, taskID uint) {
	if h.realtimeHub == nil {
		return
	}

	event := realtime.NewEvent("task.updated", "task", projectID, taskID, triggeredBy)
	h.realtimeHub.Broadcast(event, realtime.ProjectRoom(projectID), realtime.TaskRoom(taskID))
}

func (h *ChangeRequestHandler) broadcastChangeRequestChanged(eventType string, triggeredBy uint, projectID uint, taskID uint) {
	if h.realtimeHub == nil {
		return
	}

	event := realtime.NewEvent(eventType, "task", projectID, taskID, triggeredBy)
	h.realtimeHub.Broadcast(event, realtime.ProjectRoom(projectID), realtime.TaskRoom(taskID))
}
