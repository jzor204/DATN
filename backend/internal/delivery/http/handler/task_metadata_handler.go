package handler

import (
	"task-management/internal/delivery/http/realtime"
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type TaskMetadataHandler struct {
	metadataUsecase *usecase.TaskMetadataUsecase
	realtimeHub     *realtime.Hub
}

func NewTaskMetadataHandler(metadataUsecase *usecase.TaskMetadataUsecase, realtimeHub *realtime.Hub) *TaskMetadataHandler {
	return &TaskMetadataHandler{
		metadataUsecase: metadataUsecase,
		realtimeHub:     realtimeHub,
	}
}

func (h *TaskMetadataHandler) ListLabelsByTask(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	result, err := h.metadataUsecase.ListLabelsByTask(c.UserContext(), userID, globalRole, taskID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get task labels failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get task labels success", result)
}

func (h *TaskMetadataHandler) CreateLabel(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	var req dto.CreateTaskLabelRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.metadataUsecase.CreateLabel(c.UserContext(), userID, globalRole, taskID, usecase.CreateTaskLabelInput{
		Name:  req.Name,
		Color: req.Color,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "create task label failed", err.Error())
	}

	h.broadcastTaskUpdated("task.updated", result.ProjectID, result.TaskID, userID)
	return utils.Success(c, fiber.StatusCreated, "create task label success", result)
}

func (h *TaskMetadataHandler) UpdateLabel(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	labelID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid label id", err.Error())
	}

	var req dto.UpdateTaskLabelRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.metadataUsecase.UpdateLabel(c.UserContext(), userID, globalRole, labelID, usecase.UpdateTaskLabelInput{
		Name:  req.Name,
		Color: req.Color,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "update task label failed", err.Error())
	}

	h.broadcastTaskUpdated("task.updated", result.ProjectID, result.TaskID, userID)
	return utils.Success(c, fiber.StatusOK, "update task label success", result)
}

func (h *TaskMetadataHandler) DeleteLabel(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	labelID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid label id", err.Error())
	}

	taskID, projectID, err := h.metadataUsecase.DeleteLabel(c.UserContext(), userID, globalRole, labelID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete task label failed", err.Error())
	}

	h.broadcastTaskUpdated("task.updated", projectID, taskID, userID)
	return utils.Success(c, fiber.StatusOK, "delete task label success", nil)
}

func (h *TaskMetadataHandler) ListAttachmentsByTask(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	result, err := h.metadataUsecase.ListAttachmentsByTask(c.UserContext(), userID, globalRole, taskID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get task attachments failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get task attachments success", result)
}

func (h *TaskMetadataHandler) CreateAttachment(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	var req dto.CreateTaskAttachmentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.metadataUsecase.CreateAttachment(c.UserContext(), userID, globalRole, taskID, usecase.CreateTaskAttachmentInput{
		Name: req.Name,
		URL:  req.URL,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "create task attachment failed", err.Error())
	}

	h.broadcastTaskUpdated("task.updated", result.ProjectID, result.TaskID, userID)
	return utils.Success(c, fiber.StatusCreated, "create task attachment success", result)
}

func (h *TaskMetadataHandler) UpdateAttachment(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	attachmentID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid attachment id", err.Error())
	}

	var req dto.UpdateTaskAttachmentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.metadataUsecase.UpdateAttachment(c.UserContext(), userID, globalRole, attachmentID, usecase.UpdateTaskAttachmentInput{
		Name: req.Name,
		URL:  req.URL,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "update task attachment failed", err.Error())
	}

	h.broadcastTaskUpdated("task.updated", result.ProjectID, result.TaskID, userID)
	return utils.Success(c, fiber.StatusOK, "update task attachment success", result)
}

func (h *TaskMetadataHandler) DeleteAttachment(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	attachmentID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid attachment id", err.Error())
	}

	taskID, projectID, err := h.metadataUsecase.DeleteAttachment(c.UserContext(), userID, globalRole, attachmentID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete task attachment failed", err.Error())
	}

	h.broadcastTaskUpdated("task.updated", projectID, taskID, userID)
	return utils.Success(c, fiber.StatusOK, "delete task attachment success", nil)
}

func (h *TaskMetadataHandler) broadcastTaskUpdated(eventType string, projectID uint, taskID uint, triggeredBy uint) {
	if h.realtimeHub == nil {
		return
	}

	event := realtime.NewEvent(eventType, "task", projectID, taskID, triggeredBy)
	h.realtimeHub.Broadcast(event, realtime.ProjectRoom(projectID), realtime.TaskRoom(taskID))
}
