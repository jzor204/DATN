package handler

import (
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type TaskHandler struct {
	taskUsecase *usecase.TaskUsecase
}

func NewTaskHandler(taskUsecase *usecase.TaskUsecase) *TaskHandler {
	return &TaskHandler{
		taskUsecase: taskUsecase,
	}
}

// Create godoc
// @Summary Create task
// @Description Tạo task trong project
// @Tags Tasks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Param request body dto.CreateTaskRequest true "Create task request"
// @Success 201 {object} dto.TaskSuccessResponse
// @Failure 400 {object} dto.ErrorResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /projects/{id}/tasks [post]
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

	return utils.Success(c, fiber.StatusCreated, "create task success", result)
}

// ListByProject godoc
// @Summary List tasks by project
// @Description Lấy danh sách task theo project
// @Tags Tasks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Param page query int false "Page number"
// @Param page_size query int false "Page size"
// @Success 200 {object} dto.TaskListSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /projects/{id}/tasks [get]
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

// GetByID godoc
// @Summary Get task detail
// @Description Lấy chi tiết task
// @Tags Tasks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Task ID"
// @Success 200 {object} dto.TaskSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /tasks/{id} [get]
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

// Update godoc
// @Summary Update task
// @Description Cập nhật task
// @Tags Tasks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Task ID"
// @Param request body dto.UpdateTaskRequest true "Update task request"
// @Success 200 {object} dto.TaskSuccessResponse
// @Failure 400 {object} dto.ErrorResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /tasks/{id} [put]
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

	return utils.Success(c, fiber.StatusOK, "update task success", result)
}

// Delete godoc
// @Summary Delete task
// @Description Xóa task
// @Tags Tasks
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Task ID"
// @Success 200 {object} dto.SimpleSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /tasks/{id} [delete]
func (h *TaskHandler) Delete(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	if err := h.taskUsecase.Delete(c.UserContext(), userID, globalRole, taskID); err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete task failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "delete task success", nil)
}
