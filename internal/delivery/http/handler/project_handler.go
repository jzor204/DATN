package handler

import (
	"errors"
	"strconv"
	"strings"

	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type ProjectHandler struct {
	projectUsecase *usecase.ProjectUsecase
}

func NewProjectHandler(projectUsecase *usecase.ProjectUsecase) *ProjectHandler {
	return &ProjectHandler{
		projectUsecase: projectUsecase,
	}
}

// Create godoc
// @Summary Create project
// @Description Tạo project mới
// @Tags Projects
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body dto.CreateProjectRequest true "Create project request"
// @Success 201 {object} dto.ProjectSuccessResponse
// @Failure 400 {object} dto.ErrorResponse
// @Failure 401 {object} dto.ErrorResponse
// @Router /projects [post]
func (h *ProjectHandler) Create(c *fiber.Ctx) error {
	userID, _, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	var req dto.CreateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.projectUsecase.Create(c.UserContext(), userID, usecase.CreateProjectInput{
		Name:        req.Name,
		Description: req.Description,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "create project failed", err.Error())
	}

	return utils.Success(c, fiber.StatusCreated, "create project success", result)
}

// List godoc
// @Summary List projects
// @Description Lấy danh sách project
// @Tags Projects
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number"
// @Param page_size query int false "Page size"
// @Success 200 {object} dto.ProjectListSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Router /projects [get]
func (h *ProjectHandler) List(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	page, pageSize := getPagination(c)

	result, total, err := h.projectUsecase.List(c.UserContext(), userID, globalRole, page, pageSize)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get projects failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get projects success", fiber.Map{
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
// @Summary Get project detail
// @Description Lấy chi tiết project
// @Tags Projects
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Success 200 {object} dto.ProjectSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /projects/{id} [get]
func (h *ProjectHandler) GetByID(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	result, err := h.projectUsecase.GetByID(c.UserContext(), userID, globalRole, projectID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get project failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get project success", result)
}

// Update godoc
// @Summary Update project
// @Description Cập nhật project
// @Tags Projects
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Param request body dto.UpdateProjectRequest true "Update project request"
// @Success 200 {object} dto.ProjectSuccessResponse
// @Failure 400 {object} dto.ErrorResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /projects/{id} [put]
func (h *ProjectHandler) Update(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	var req dto.UpdateProjectRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.projectUsecase.Update(c.UserContext(), userID, globalRole, projectID, usecase.UpdateProjectInput{
		Name:        req.Name,
		Description: req.Description,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "update project failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "update project success", result)
}

// Delete godoc
// @Summary Delete project
// @Description Xóa project
// @Tags Projects
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Success 200 {object} dto.SimpleSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /projects/{id} [delete]
func (h *ProjectHandler) Delete(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	if err := h.projectUsecase.Delete(c.UserContext(), userID, globalRole, projectID); err != nil {
		return utils.Error(c, projectErrorStatus(err), "delete project failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "delete project success", nil)
}

// ListMembers godoc
// @Summary List project members
// @Description Lấy danh sách thành viên trong project
// @Tags Project Members
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Param page query int false "Page number"
// @Param page_size query int false "Page size"
// @Success 200 {object} dto.ProjectMemberListSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /projects/{id}/members [get]
func (h *ProjectHandler) ListMembers(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	page, pageSize := getPagination(c)

	result, total, err := h.projectUsecase.ListMembers(c.UserContext(), userID, globalRole, projectID, page, pageSize)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get project members failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get project members success", fiber.Map{
		"data": result,
		"pagination": dto.PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: calculateTotalPages(total, pageSize),
		},
	})
}

// @Summary Add project member
// @Description Thêm thành viên vào project
// @Tags Project Members
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Param request body dto.AddProjectMemberRequest true "Add project member request"
// @Success 201 {object} dto.ProjectMemberSuccessResponse
// @Failure 400 {object} dto.ErrorResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /projects/{id}/members [post]
func (h *ProjectHandler) AddMember(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	var req dto.AddProjectMemberRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.projectUsecase.AddMember(c.UserContext(), userID, globalRole, projectID, usecase.AddProjectMemberInput{
		UserID:        req.UserID,
		RoleInProject: req.RoleInProject,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "add project member failed", err.Error())
	}

	return utils.Success(c, fiber.StatusCreated, "add project member success", result)
}

// RemoveMember godoc
// @Summary Remove project member
// @Description Xóa thành viên khỏi project
// @Tags Project Members
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Param userId path int true "User ID"
// @Success 200 {object} dto.SimpleSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Failure 403 {object} dto.ErrorResponse
// @Failure 404 {object} dto.ErrorResponse
// @Router /projects/{id}/members/{userId} [delete]
func (h *ProjectHandler) RemoveMember(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	targetUserID, err := parseUintParam(c, "userId")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid target user id", err.Error())
	}

	if err := h.projectUsecase.RemoveMember(c.UserContext(), userID, globalRole, projectID, targetUserID); err != nil {
		return utils.Error(c, projectErrorStatus(err), "remove project member failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "remove project member success", nil)
}

func getAuthContext(c *fiber.Ctx) (uint, string, error) {
	userIDValue := c.Locals("userID")
	userID, ok := userIDValue.(uint)
	if !ok || userID == 0 {
		return 0, "", errors.New("invalid user context")
	}

	globalRoleValue := c.Locals("globalRole")
	globalRole, _ := globalRoleValue.(string)

	return userID, globalRole, nil
}

func parseUintParam(c *fiber.Ctx, key string) (uint, error) {
	value := strings.TrimSpace(c.Params(key))
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0, err
	}
	return uint(parsed), nil
}

func getPagination(c *fiber.Ctx) (int, int) {
	page := c.QueryInt("page", 1)
	pageSize := c.QueryInt("page_size", 10)

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	return page, pageSize
}

func calculateTotalPages(total int64, pageSize int) int64 {
	if pageSize <= 0 {
		return 0
	}
	return (total + int64(pageSize) - 1) / int64(pageSize)
}

func projectErrorStatus(err error) int {
	message := strings.ToLower(err.Error())

	switch {
	case strings.Contains(message, "unauthorized"):
		return fiber.StatusUnauthorized
	case strings.Contains(message, "forbidden"):
		return fiber.StatusForbidden
	case strings.Contains(message, "not found"):
		return fiber.StatusNotFound
	default:
		return fiber.StatusBadRequest
	}
}
