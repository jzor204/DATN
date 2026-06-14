package handler

import (
	"strings"

	"task-management/internal/delivery/http/realtime"
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type TaskHandler struct {
	taskUsecase    *usecase.TaskUsecase
	projectUsecase *usecase.ProjectUsecase
	realtimeHub    *realtime.Hub
}

func NewTaskHandler(taskUsecase *usecase.TaskUsecase, projectUsecase *usecase.ProjectUsecase, realtimeHub *realtime.Hub) *TaskHandler {
	return &TaskHandler{
		taskUsecase:    taskUsecase,
		projectUsecase: projectUsecase,
		realtimeHub:    realtimeHub,
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
		Priority:    req.Priority,
		AssigneeID:  req.AssigneeID,
		AssigneeIDs: req.AssigneeIDs,
		Deadline:    req.Deadline.Value,
		ReminderAt:  req.ReminderAt.Value,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "create task failed", err.Error())
	}

	h.broadcastTaskEvent("task.created", result.ProjectID, result.ID, userID, false)

	return utils.Success(c, fiber.StatusCreated, "create task success", taskResponse(result))
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

	result, total, err := h.taskUsecase.ListByProject(c.UserContext(), userID, globalRole, projectID, usecase.ListTasksByProjectInput{
		ArchiveFilter: queryValue(c, "archive"),
		Page:          page,
		PageSize:      pageSize,
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get tasks failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get tasks success", fiber.Map{
		"data": taskListResponse(result),
		"pagination": dto.PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: calculateTotalPages(total, pageSize),
		},
	})
}

func (h *TaskHandler) ListMine(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	status := strings.Clone(queryValue(c, "status"))
	rawProjectID := strings.Clone(queryValue(c, "project_id"))
	candidateQuery := strings.Clone(queryValue(c, "q"))
	originalURL := strings.ToLower(strings.Clone(c.OriginalURL()))
	candidateMode := strings.Contains(strings.ToLower(status), "candidate") ||
		strings.Contains(originalURL, "status=candidates")
	page, pageSize := getPagination(c)
	if !candidateMode {
		candidateMode = strings.Contains(strings.ToLower(status), "candidate") ||
			strings.Contains(strings.ToLower(c.OriginalURL()), "status=candidates")
	}

	if candidateMode {
		if rawProjectID == "" {
			return utils.Error(c, fiber.StatusBadRequest, "invalid project id", "project_id is required")
		}

		projectID, err := parseUintQuery(rawProjectID)
		if err != nil {
			return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
		}

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

	var projectID *uint
	if rawProjectID != "" {
		parsedProjectID, err := parseUintQuery(rawProjectID)
		if err != nil {
			return utils.Error(c, fiber.StatusBadRequest, "invalid project id", err.Error())
		}
		projectID = &parsedProjectID
	}

	result, total, err := h.taskUsecase.ListAssignedToUser(
		c.UserContext(),
		userID,
		globalRole,
		usecase.ListMyTasksInput{
			ProjectID: projectID,
			Status:    status,
			Page:      page,
			PageSize:  pageSize,
		},
	)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get my tasks failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get my tasks success", fiber.Map{
		"data": taskListResponse(result),
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

	return utils.Success(c, fiber.StatusOK, "get task success", taskResponse(result))
}

func (h *TaskHandler) ListAssignees(c *fiber.Ctx) error {
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
		return utils.Error(c, projectErrorStatus(err), "get task assignees failed", err.Error())
	}

	assigneeIDs := append([]uint{}, result.Assignees...)
	if len(assigneeIDs) == 0 && result.AssigneeID != nil {
		assigneeIDs = append(assigneeIDs, *result.AssigneeID)
	}

	return utils.Success(c, fiber.StatusOK, "get task assignees success", assigneeIDs)
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
		Priority:    req.Priority,
		AssigneeID:  req.AssigneeID,
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
	})
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "update task failed", err.Error())
	}

	h.broadcastTaskEvent("task.updated", result.ProjectID, result.ID, userID, true)

	return utils.Success(c, fiber.StatusOK, "update task success", taskResponse(result))
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

func (h *TaskHandler) Archive(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	result, err := h.taskUsecase.Archive(c.UserContext(), userID, globalRole, taskID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "archive task failed", err.Error())
	}

	h.broadcastTaskEvent("task.archived", result.ProjectID, result.ID, userID, true)

	return utils.Success(c, fiber.StatusOK, "archive task success", taskResponse(result))
}

func (h *TaskHandler) Restore(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	result, err := h.taskUsecase.Restore(c.UserContext(), userID, globalRole, taskID)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "restore task failed", err.Error())
	}

	h.broadcastTaskEvent("task.restored", result.ProjectID, result.ID, userID, true)

	return utils.Success(c, fiber.StatusOK, "restore task success", taskResponse(result))
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

func taskListResponse(tasks []usecase.TaskOutput) []fiber.Map {
	result := make([]fiber.Map, 0, len(tasks))
	for i := range tasks {
		result = append(result, taskResponse(&tasks[i]))
	}
	return result
}

func taskResponse(task *usecase.TaskOutput) fiber.Map {
	assigneeIDs := append([]uint{}, task.Assignees...)
	if len(assigneeIDs) == 0 && task.AssigneeID != nil {
		assigneeIDs = append(assigneeIDs, *task.AssigneeID)
	}

	payload := fiber.Map{
		"id":           task.ID,
		"project_id":   task.ProjectID,
		"title":        task.Title,
		"description":  task.Description,
		"status":       task.Status,
		"progress":     task.Progress,
		"priority":     task.Priority,
		"assignee_id":  task.AssigneeID,
		"assignee_ids": assigneeIDs,
		"deadline":     task.Deadline,
		"reminder_at":  task.ReminderAt,
		"archived_at":  task.ArchivedAt,
		"archived_by":  task.ArchivedBy,
		"created_by":   task.CreatedBy,
		"created_at":   task.CreatedAt,
		"updated_at":   task.UpdatedAt,
	}

	if task.ProjectName != "" {
		payload["project_name"] = task.ProjectName
	}

	return payload
}
