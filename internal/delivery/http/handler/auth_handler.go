package handler

import (
	"task-management/internal/dto"
	"task-management/internal/usecase"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

type AuthHandler struct {
	authUsecase *usecase.AuthUsecase
}

func NewAuthHandler(authUsecase *usecase.AuthUsecase) *AuthHandler {
	return &AuthHandler{
		authUsecase: authUsecase,
	}
}

// Register godoc
// @Summary Register account
// @Description Đăng ký tài khoản mới
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body dto.RegisterRequest true "Register request"
// @Success 201 {object} dto.AuthSuccessResponse
// @Failure 400 {object} dto.ErrorResponse
// @Router /auth/register [post]
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req dto.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.authUsecase.Register(c.UserContext(), usecase.RegisterInput{
		Name:     req.Name,
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "register failed", err.Error())
	}

	return utils.Success(c, fiber.StatusCreated, "register success", dto.AuthResponse{
		AccessToken: result.AccessToken,
	})
}

// Login godoc
// @Summary Login
// @Description Đăng nhập và lấy access token
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body dto.LoginRequest true "Login request"
// @Success 200 {object} dto.AuthSuccessResponse
// @Failure 400 {object} dto.ErrorResponse
// @Failure 401 {object} dto.ErrorResponse
// @Router /auth/login [post]
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req dto.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return utils.Error(c, fiber.StatusBadRequest, "invalid request body", err.Error())
	}

	result, err := h.authUsecase.Login(c.UserContext(), usecase.LoginInput{
		Email:    req.Email,
		Password: req.Password,
	})
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "login failed", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "login success", dto.AuthResponse{
		AccessToken: result.AccessToken,
	})
}

// Me godoc
// @Summary Get my profile
// @Description Lấy thông tin user hiện tại
// @Tags Auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} dto.MeSuccessResponse
// @Failure 401 {object} dto.ErrorResponse
// @Router /auth/me [get]
func (h *AuthHandler) Me(c *fiber.Ctx) error {
	userIDValue := c.Locals("userID")
	userID, ok := userIDValue.(uint)
	if !ok || userID == 0 {
		return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", "invalid user context")
	}

	result, err := h.authUsecase.Me(c.UserContext(), userID)
	if err != nil {
		return utils.Error(c, fiber.StatusUnauthorized, "failed to get profile", err.Error())
	}

	return utils.Success(c, fiber.StatusOK, "get profile success", result)
}
