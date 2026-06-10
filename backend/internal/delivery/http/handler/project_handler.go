package handler

import (
	"errors"
	"net/url"
	"strconv"
	"strings"

	"task-management/internal/delivery/http/realtime"
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type ProjectHandler struct {
	projectUsecase *usecase.ProjectUsecase
	realtimeHub    *realtime.Hub
}

func NewProjectHandler(projectUsecase *usecase.ProjectUsecase, realtimeHub *realtime.Hub) *ProjectHandler {
	return &ProjectHandler{
		projectUsecase: projectUsecase,
		realtimeHub:    realtimeHub,
	}
}

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

	h.broadcastProjectEvent("project.created", result.ID, userID)

	return utils.Success(c, fiber.StatusCreated, "create project success", result)
}

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

	h.broadcastProjectEvent("project.updated", result.ID, userID)

	return utils.Success(c, fiber.StatusOK, "update project success", result)
}

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

	h.broadcastProjectEvent("project.deleted", projectID, userID)

	return utils.Success(c, fiber.StatusOK, "delete project success", nil)
}

func (h *ProjectHandler) ListMembers(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	candidateMode := c.QueryBool("candidates", false) ||
		c.QueryInt("candidates", 0) == 1 ||
		strings.EqualFold(queryValue(c, "candidates"), "true") ||
		strings.EqualFold(queryValue(c, "view"), "candidates")
	candidateQuery := queryValue(c, "q")
	page, pageSize := getPagination(c)

	if candidateMode {
		result, total, err := h.projectUsecase.ListMemberCandidates(
			c.UserContext(),
			userID,
			globalRole,
			projectID,
			candidateQuery,
			page,
			pageSize,
		)
		if err != nil {
			return utils.Error(c, projectErrorStatus(err), "get member candidates failed", err.Error())
		}

		return utils.Success(c, fiber.StatusOK, "get member candidates success", fiber.Map{
			"data": result,
			"pagination": dto.PaginationResponse{
				Page:       page,
				PageSize:   pageSize,
				Total:      total,
				TotalPages: calculateTotalPages(total, pageSize),
			},
		})
	}

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

func (h *ProjectHandler) ListMemberCandidates(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	projectID, err := parseProjectIDParamOrQuery(c)
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
	}

	query := queryValue(c, "q")
	page, pageSize := getPagination(c)

	result, total, err := h.projectUsecase.ListMemberCandidates(
		c.UserContext(),
		userID,
		globalRole,
		projectID,
		query,
		page,
		pageSize,
	)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get member candidates failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get member candidates success", fiber.Map{
		"data": result,
		"pagination": dto.PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: calculateTotalPages(total, pageSize),
		},
	})
}

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

	h.broadcastProjectEvent("project.members.changed", projectID, userID)

	return utils.Success(c, fiber.StatusCreated, "add project member success", result)
}

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

	h.broadcastProjectEvent("project.members.changed", projectID, userID)

	return utils.Success(c, fiber.StatusOK, "remove project member success", nil)
}

func (h *ProjectHandler) broadcastProjectEvent(eventType string, projectID uint, triggeredBy uint) {
	if h.realtimeHub == nil {
		return
	}

	event := realtime.NewEvent(eventType, "project", projectID, 0, triggeredBy)
	h.realtimeHub.Broadcast(event, realtime.ProjectsListRoom(), realtime.ProjectRoom(projectID))
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

func parseProjectIDParamOrQuery(c *fiber.Ctx) (uint, error) {
	rawParam := strings.TrimSpace(c.Params("id"))
	if rawParam != "" {
		return parseUintParam(c, "id")
	}

	rawQuery := strings.TrimSpace(queryValue(c, "project_id"))
	if rawQuery == "" {
		return 0, errors.New("project_id is required")
	}

	return parseUintQuery(rawQuery)
}

func queryValue(c *fiber.Ctx, key string) string {
	if value := c.Query(key); value != "" {
		return strings.Clone(value)
	}

	parsedURL, err := url.ParseRequestURI(c.OriginalURL())
	if err != nil {
		return ""
	}

	return strings.Clone(parsedURL.Query().Get(key))
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
