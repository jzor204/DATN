package handler

import (
	"task-management/internal/delivery/http/realtime"
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type ChecklistItemHandler struct {
	checklistUsecase *usecase.ChecklistItemUsecase
	taskUsecase      *usecase.TaskUsecase
	realtimeHub      *realtime.Hub
}

func NewChecklistItemHandler(
	checklistUsecase *usecase.ChecklistItemUsecase,
	taskUsecase *usecase.TaskUsecase,
	realtimeHub *realtime.Hub,
) *ChecklistItemHandler {
	return &ChecklistItemHandler{
		checklistUsecase: checklistUsecase,
		taskUsecase:      taskUsecase,
		realtimeHub:      realtimeHub,
	}
}

func (h *ChecklistItemHandler) ListByTask(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	result, err := h.checklistUsecase.ListByTask(c.UserContext(), userID, globalRole, taskID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get checklists failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get checklists success", result)
}

func (h *ChecklistItemHandler) CreateChecklist(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	var req dto.CreateChecklistRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.checklistUsecase.CreateChecklist(
		c.UserContext(),
		userID,
		globalRole,
		taskID,
		usecase.CreateChecklistInput{Title: req.Title},
	)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "create checklist failed", err.Error())
	}

	h.broadcastTaskUpdated(c, userID, globalRole, result.TaskID)

	return utils.Success(c, fiber.StatusCreated, "create checklist success", fiber.Map{
		"checklist": result,
	})
}

func (h *ChecklistItemHandler) DeleteChecklist(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	checklistID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid checklist id", err.Error())
	}

	taskID, progress, err := h.checklistUsecase.DeleteChecklist(c.UserContext(), userID, globalRole, checklistID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete checklist failed", err.Error())
	}

	h.broadcastTaskUpdated(c, userID, globalRole, taskID)

	return utils.Success(c, fiber.StatusOK, "delete checklist success", fiber.Map{
		"progress": progress,
	})
}

func (h *ChecklistItemHandler) CreateItem(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	checklistID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid checklist id", err.Error())
	}

	var req dto.CreateChecklistItemRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, progress, err := h.checklistUsecase.CreateItem(
		c.UserContext(),
		userID,
		globalRole,
		checklistID,
		usecase.CreateChecklistItemInput{Title: req.Title},
	)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "create checklist item failed", err.Error())
	}

	h.broadcastTaskUpdated(c, userID, globalRole, result.TaskID)

	return utils.Success(c, fiber.StatusCreated, "create checklist item success", fiber.Map{
		"item":     result,
		"progress": progress,
	})
}

func (h *ChecklistItemHandler) Update(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	itemID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid checklist item id", err.Error())
	}

	var req dto.UpdateChecklistItemRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, progress, err := h.checklistUsecase.Update(
		c.UserContext(),
		userID,
		globalRole,
		itemID,
		usecase.UpdateChecklistItemInput{
			Title:  req.Title,
			IsDone: req.IsDone,
		},
	)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "update checklist item failed", err.Error())
	}

	h.broadcastTaskUpdated(c, userID, globalRole, result.TaskID)

	return utils.Success(c, fiber.StatusOK, "update checklist item success", fiber.Map{
		"item":     result,
		"progress": progress,
	})
}

func (h *ChecklistItemHandler) Delete(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	itemID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid checklist item id", err.Error())
	}

	taskID, progress, err := h.checklistUsecase.Delete(c.UserContext(), userID, globalRole, itemID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete checklist item failed", err.Error())
	}

	h.broadcastTaskUpdated(c, userID, globalRole, taskID)

	return utils.Success(c, fiber.StatusOK, "delete checklist item success", fiber.Map{
		"progress": progress,
	})
}

func (h *ChecklistItemHandler) broadcastTaskUpdated(c *fiber.Ctx, userID uint, globalRole string, taskID uint) {
	if h.realtimeHub == nil {
		return
	}

	task, err := h.taskUsecase.GetByID(c.UserContext(), userID, globalRole, taskID)
	if err != nil || task == nil {
		return
	}

	event := realtime.NewEvent("task.updated", "task", task.ProjectID, task.ID, userID)
	h.realtimeHub.Broadcast(event, realtime.ProjectRoom(task.ProjectID), realtime.TaskRoom(task.ID))
}
