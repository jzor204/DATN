package handler

import (
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type CommentHandler struct {
	commentUsecase *usecase.CommentUsecase
}

func NewCommentHandler(commentUsecase *usecase.CommentUsecase) *CommentHandler {
	return &CommentHandler{
		commentUsecase: commentUsecase,
	}
}

// ListByTask godoc
// @Summary List comments by task
// @Description Lấy danh sách comment theo task
// @Tags Comments
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Task ID"
// @Param page query int false "Page number"
// @Param page_size query int false "Page size"
// @Success 200 {object} dto.CommentListSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /tasks/{id}/comments [get]
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

// Create godoc
// @Summary Create comment
// @Description Tạo comment cho task
// @Tags Comments
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Task ID"
// @Param request body dto.CreateCommentRequest true "Create comment request"
// @Success 201 {object} dto.CommentSuccessResponse
// @Failure 400 {object} dto.ErrorResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /tasks/{id}/comments [post]
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

	return utils.Success(c, fiber.StatusCreated, "create comment success", result)
}

// Update godoc
// @Summary Update comment
// @Description Cập nhật comment
// @Tags Comments
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Comment ID"
// @Param request body dto.UpdateCommentRequest true "Update comment request"
// @Success 200 {object} dto.CommentSuccessResponse
// @Failure 400 {object} dto.ErrorResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /comments/{id} [put]
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

	return utils.Success(c, fiber.StatusOK, "update comment success", result)
}

// Delete godoc
// @Summary Delete comment
// @Description Xóa comment
// @Tags Comments
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Comment ID"
// @Success 200 {object} dto.SimpleSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /comments/{id} [delete]
func (h *CommentHandler) Delete(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	commentID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid comment id", err.Error())
	}

	if err := h.commentUsecase.Delete(
		c.UserContext(),
		userID,
		globalRole,
		commentID,
	); err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete comment failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "delete comment success", nil)
}
