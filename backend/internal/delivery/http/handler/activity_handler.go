package handler

import (
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type ActivityHandler struct {
	activityUsecase *usecase.ActivityUsecase
}

func NewActivityHandler(activityUsecase *usecase.ActivityUsecase) *ActivityHandler {
	return &ActivityHandler{activityUsecase: activityUsecase}
}

func (h *ActivityHandler) ListByTask(c *fiber.Ctx) error {
	userID, globalRole, err := getAuthContext(c)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", err.Error())
	}

	taskID, err := parseUintParam(c, "id")
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid task id", err.Error())
	}

	page, pageSize := getPagination(c)
	result, total, err := h.activityUsecase.ListByTask(c.UserContext(), userID, globalRole, taskID, page, pageSize)
	if err != nil {
		return utils.Error(c, projectErrorStatus(err), "get activities failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get activities success", fiber.Map{
		"data": result,
		"pagination": dto.PaginationResponse{
			Page:       page,
			PageSize:   pageSize,
			Total:      total,
			TotalPages: calculateTotalPages(total, pageSize),
		},
	})
}
