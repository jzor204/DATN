package middleware

import (
	"strings"

	"task-management/internal/usecase/interfaces"
	"task-management/pkg/utils"

	"github.com/gofiber/fiber/v2"
)

func AuthMiddleware(jwtService interfaces.JWTService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", "missing authorization header")
		}

		const bearerPrefix = "Bearer "
		if !strings.HasPrefix(authHeader, bearerPrefix) {
			return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", "invalid authorization header")
		}

		token := strings.TrimSpace(strings.TrimPrefix(authHeader, bearerPrefix))
		if token == "" {
			return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", "missing access token")
		}

		claims, err := jwtService.ParseAccessToken(token)
		if err != nil {
			return utils.Error(c, fiber.StatusUnauthorized, "unauthorized", "invalid or expired token")
		}

		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("globalRole", claims.GlobalRole)

		return c.Next()
	}
}
