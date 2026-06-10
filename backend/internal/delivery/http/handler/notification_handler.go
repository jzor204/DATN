package handler

import (
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type NotificationHandler struct {
	notificationUsecase *usecase.NotificationUsecase
}

func NewNotificationHandler(notificationUsecase *usecase.NotificationUsecase) *NotificationHandler {
	return &NotificationHandler{notificationUsecase: notificationUsecase}
}

func (h *NotificationHandler) List(c *fiber.Ctx) error {
	userID, _, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	page, pageSize := getPagination(c)

	result, total, err := h.notificationUsecase.ListByUser(c.UserContext(), userID, page, pageSize)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get notifications failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get notifications success", fiber.Map{
		"data": result,
		"pagination": dto.PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: calculateTotalPages(total, pageSize),
		},
	})
}

func (h *NotificationHandler) MarkRead(c *fiber.Ctx) error {
	userID, _, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	notificationID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid notification id", err.Error())
	}

	if err := h.notificationUsecase.MarkRead(c.UserContext(), userID, notificationID); err != nil {
		return utils.Error(c, projectErrorStatus(err), "mark notification read failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "mark notification read success", nil)
}
