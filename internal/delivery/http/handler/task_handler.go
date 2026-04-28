package handler

import (
	"task-management/internal/delivery/http/realtime"
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type TaskHandler struct {
	taskUsecase *usecase.TaskUsecase
	realtimeHub *realtime.Hub
}

func NewTaskHandler(taskUsecase *usecase.TaskUsecase, realtimeHub *realtime.Hub) *TaskHandler {
	return &TaskHandler{
		taskUsecase: taskUsecase,
		realtimeHub: realtimeHub,
	}
}

func (h *TaskHandler) Create(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	var req dto.CreateTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.taskUsecase.Create(c.UserContext(), userID, globalRole, projectID, usecase.CreateTaskInput{
		Title:       req.Title,
		Description: req.Description,
		AssigneeID:  req.AssigneeID,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "create task failed", err.Error())
	}

	h.broadcastTaskEvent("task.created", result.ProjectID, result.ID, userID, false)

	return utils.Success(c, fiber.StatusCreated, "create task success", result)
}

func (h *TaskHandler) ListByProject(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	page, pageSize := getPagination(c)

	result, total, err := h.taskUsecase.ListByProject(c.UserContext(), userID, globalRole, projectID, page, pageSize)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get tasks failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get tasks success", fiber.Map{
		"data": result,
		"pagination": dto.PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: calculateTotalPages(total, pageSize),
		},
	})
}

func (h *TaskHandler) GetByID(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	result, err := h.taskUsecase.GetByID(c.UserContext(), userID, globalRole, taskID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get task failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get task success", result)
}

func (h *TaskHandler) Update(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	var req dto.UpdateTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.taskUsecase.Update(c.UserContext(), userID, globalRole, taskID, usecase.UpdateTaskInput{
		Title:       req.Title,
		Description: req.Description,
		Status:      req.Status,
		AssigneeID:  req.AssigneeID,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "update task failed", err.Error())
	}

	h.broadcastTaskEvent("task.updated", result.ProjectID, result.ID, userID, true)

	return utils.Success(c, fiber.StatusOK, "update task success", result)
}

func (h *TaskHandler) Delete(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	task, err := h.taskUsecase.GetByID(c.UserContext(), userID, globalRole, taskID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete task failed", err.Error())
	}

	if err := h.taskUsecase.Delete(c.UserContext(), userID, globalRole, taskID); err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete task failed", err.Error())
	}

	h.broadcastTaskEvent("task.deleted", task.ProjectID, task.ID, userID, true)

	return utils.Success(c, fiber.StatusOK, "delete task success", nil)
}

func (h *TaskHandler) broadcastTaskEvent(eventType string, projectID uint, taskID uint, triggeredBy uint, includeTaskRoom bool) {
	if h.realtimeHub == nil {
		return
	}

	event := realtime.NewEvent(eventType, "task", projectID, taskID, triggeredBy)
	rooms := []string{realtime.ProjectRoom(projectID)}

	if includeTaskRoom && taskID != 0 {
		rooms = append(rooms, realtime.TaskRoom(taskID))
	}

	h.realtimeHub.Broadcast(event, rooms...)
}
