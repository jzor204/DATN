package handler

import (
	"task-management/internal/delivery/http/realtime"
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type CommentHandler struct {
	commentUsecase *usecase.CommentUsecase
	taskUsecase    *usecase.TaskUsecase
	realtimeHub    *realtime.Hub
}

func NewCommentHandler(
	commentUsecase *usecase.CommentUsecase,
	taskUsecase *usecase.TaskUsecase,
	realtimeHub *realtime.Hub,
) *CommentHandler {
	return &CommentHandler{
		commentUsecase: commentUsecase,
		taskUsecase:    taskUsecase,
		realtimeHub:    realtimeHub,
	}
}

func (h *CommentHandler) ListByTask(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	page, pageSize := getPagination(c)

	result, total, err := h.commentUsecase.ListByTask(
		c.UserContext(),
		userID,
		globalRole,
		taskID,
		page,
		pageSize,
	)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get comments failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get comments success", fiber.Map{
		"data": result,
		"pagination": dto.PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: calculateTotalPages(total, pageSize),
		},
	})
}

func (h *CommentHandler) Create(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	var req dto.CreateCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.commentUsecase.Create(
		c.UserContext(),
		userID,
		globalRole,
		taskID,
		usecase.CreateCommentInput{
			Content: req.Content,
		},
	)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "create comment failed", err.Error())
	}

	projectID := uint(0)
	if task, taskErr := h.taskUsecase.GetByID(c.UserContext(), userID, globalRole, result.TaskID); taskErr == nil && task != nil {
		projectID = task.ProjectID
	}

	h.broadcastCommentEvent("comment.created", projectID, result.TaskID, userID)

	return utils.Success(c, fiber.StatusCreated, "create comment success", result)
}

func (h *CommentHandler) Update(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	commentID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid comment id", err.Error())
	}

	var req dto.UpdateCommentRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.commentUsecase.Update(
		c.UserContext(),
		userID,
		globalRole,
		commentID,
		usecase.UpdateCommentInput{
			Content: req.Content,
		},
	)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "update comment failed", err.Error())
	}

	projectID := uint(0)
	if task, taskErr := h.taskUsecase.GetByID(c.UserContext(), userID, globalRole, result.TaskID); taskErr == nil && task != nil {
		projectID = task.ProjectID
	}

	h.broadcastCommentEvent("comment.updated", projectID, result.TaskID, userID)

	return utils.Success(c, fiber.StatusOK, "update comment success", result)
}

func (h *CommentHandler) Delete(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	commentID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid comment id", err.Error())
	}

	comment, err := h.commentUsecase.GetByID(c.UserContext(), userID, globalRole, commentID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete comment failed", err.Error())
	}

	projectID := uint(0)
	if task, taskErr := h.taskUsecase.GetByID(c.UserContext(), userID, globalRole, comment.TaskID); taskErr == nil && task != nil {
		projectID = task.ProjectID
	}

	if err := h.commentUsecase.Delete(
		c.UserContext(),
		userID,
		globalRole,
		commentID,
	); err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete comment failed", err.Error())
	}

	h.broadcastCommentEvent("comment.deleted", projectID, comment.TaskID, userID)

	return utils.Success(c, fiber.StatusOK, "delete comment success", nil)
}

func (h *CommentHandler) broadcastCommentEvent(eventType string, projectID uint, taskID uint, triggeredBy uint) {
	if h.realtimeHub == nil {
		return
	}

	event := realtime.NewEvent(eventType, "task", projectID, taskID, triggeredBy)
	h.realtimeHub.Broadcast(event, realtime.TaskRoom(taskID))
}
