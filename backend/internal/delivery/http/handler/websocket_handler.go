package handler

import (
	"errors"
	"strconv"
	"strings"

	"task-management/internal/delivery/http/realtime"
	"task-management/internal/usecase"
	"task-management/internal/usecase/interfaces"
	"task-management/pkg/utils"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

type WebSocketHandler struct {
	hub            *realtime.Hub
	jwtService     interfaces.JWTService
	projectUsecase *usecase.ProjectUsecase
	taskUsecase    *usecase.TaskUsecase
}

func NewWebSocketHandler(
	hub *realtime.Hub,
	jwtService interfaces.JWTService,
	projectUsecase *usecase.ProjectUsecase,
	taskUsecase *usecase.TaskUsecase,
) *WebSocketHandler {
	return &WebSocketHandler{
		hub:            hub,
		jwtService:     jwtService,
		projectUsecase: projectUsecase,
		taskUsecase:    taskUsecase,
	}
}

func WebSocketUpgradeRequired(c *fiber.Ctx) error {
	if websocket.IsWebSocketUpgrade(c) {
		return c.Next()
	}

	return fiber.ErrUpgradeRequired
}

func (h *WebSocketHandler) Authorize(c *fiber.Ctx) error {
	token := strings.TrimSpace(c.Query("token"))
	if token == "" {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", "missing access token")
	}

	claims, err := h.jwtService.ParseAccessToken(token)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", "invalid or expired token")
	}

	room, err := h.resolveRoom(c, claims.UserID, claims.GlobalRole)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "websocket connection rejected", err.Error())
	}

	c.Locals("room", room)
	c.Locals("userID", claims.UserID)
	c.Locals("globalRole", claims.GlobalRole)

	return c.Next()
}

func (h *WebSocketHandler) Handle() fiber.Handler {
	return websocket.New(func(conn *websocket.Conn) {
		roomValue := conn.Locals("room")
		room, _ := roomValue.(string)
		if room == "" {
			return
		}

		h.hub.Subscribe(room, conn)
		defer h.hub.UnsubscribeAll(conn)
		defer conn.Close()

		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	})
}

func (h *WebSocketHandler) resolveRoom(c *fiber.Ctx, userID uint, globalRole string) (string, error) {
	scope := strings.ToLower(strings.TrimSpace(c.Query("scope")))

	switch scope {
	case "projects":
		return realtime.ProjectsListRoom(), nil

	case "project":
		projectID, err := parseUintQuery(c.Query("project_id"))
		if err != nil {
			return "", errors.New("invalid project_id")
		}

		if _, err := h.projectUsecase.GetByID(c.UserContext(), userID, globalRole, projectID); err != nil {
			return "", err
		}

		return realtime.ProjectRoom(projectID), nil

	case "task":
		taskID, err := parseUintQuery(c.Query("task_id"))
		if err != nil {
			return "", errors.New("invalid task_id")
		}

		task, err := h.taskUsecase.GetByID(c.UserContext(), userID, globalRole, taskID)
		if err != nil {
			return "", err
		}

		return realtime.TaskRoom(task.ID), nil

	case "notifications", "user":
		return realtime.UserRoom(userID), nil

	default:
		return "", errors.New("invalid scope")
	}
}

func parseUintQuery(value string) (uint, error) {
	parsed, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return 0, err
	}

	return uint(parsed), nil
}
