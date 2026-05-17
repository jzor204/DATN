package http

import (
	"task-management/internal/delivery/http/handler"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	swagger "github.com/gofiber/swagger"
)

func NewRouter(
	authHandler *handler.AuthHandler,
	projectHandler *handler.ProjectHandler,
	taskHandler *handler.TaskHandler,
	commentHandler *handler.CommentHandler,
	wsHandler *handler.WebSocketHandler,
	authMiddleware fiber.Handler,
) *fiber.App {
	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Origin,Content-Type,Accept,Authorization",
	}))

	app.Get("/swagger/*", swagger.HandlerDefault)
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "task management api is running",
		})
	})

	api := app.Group("/api/v1")

	api.Get("/ws", handler.WebSocketUpgradeRequired, wsHandler.Authorize, wsHandler.Handle())

	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Get("/me", authMiddleware, authHandler.Me)

	projects := api.Group("/projects", authMiddleware)
	projects.Post("/", projectHandler.Create)
	projects.Get("/", projectHandler.List)
	projects.Get("/:id", projectHandler.GetByID)
	projects.Put("/:id", projectHandler.Update)
	projects.Delete("/:id", projectHandler.Delete)

	projects.Get("/:id/members", projectHandler.ListMembers)
	projects.Post("/:id/members", projectHandler.AddMember)
	projects.Delete("/:id/members/:userId", projectHandler.RemoveMember)

	projects.Post("/:id/tasks", taskHandler.Create)
	projects.Get("/:id/tasks", taskHandler.ListByProject)

	tasks := api.Group("/tasks", authMiddleware)
	tasks.Get("/me", taskHandler.ListMine)
	tasks.Get("/:id", taskHandler.GetByID)
	tasks.Put("/:id", taskHandler.Update)
	tasks.Delete("/:id", taskHandler.Delete)
	tasks.Get("/:id/comments", commentHandler.ListByTask)
	tasks.Post("/:id/comments", commentHandler.Create)

	comments := api.Group("/comments", authMiddleware)
	comments.Put("/:id", commentHandler.Update)
	comments.Delete("/:id", commentHandler.Delete)

	return app
}
