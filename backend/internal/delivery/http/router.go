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
	checklistItemHandler *handler.ChecklistItemHandler,
	taskMetadataHandler *handler.TaskMetadataHandler,
	activityHandler *handler.ActivityHandler,
	notificationHandler *handler.NotificationHandler,
	changeRequestHandler *handler.ChangeRequestHandler,
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
	app.Get("/api/v1/task-assignees/tasks/:id", authMiddleware, taskHandler.ListAssignees)

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
	tasks.Get("/:id/comments", commentHandler.ListByTask)
	tasks.Post("/:id/comments", commentHandler.Create)
	tasks.Get("/:id/activities", activityHandler.ListByTask)
	tasks.Get("/:id/change-requests", changeRequestHandler.ListByTask)
	tasks.Post("/:id/change-requests", changeRequestHandler.CreateForTask)
	tasks.Get("/:id/labels", taskMetadataHandler.ListLabelsByTask)
	tasks.Post("/:id/labels", taskMetadataHandler.CreateLabel)
	tasks.Get("/:id/task-labels", taskMetadataHandler.ListLabelsByTask)
	tasks.Post("/:id/task-labels", taskMetadataHandler.CreateLabel)
	tasks.Get("/:id/attachments", taskMetadataHandler.ListAttachmentsByTask)
	tasks.Post("/:id/attachments", taskMetadataHandler.CreateAttachment)
	tasks.Get("/:id/task-attachments", taskMetadataHandler.ListAttachmentsByTask)
	tasks.Post("/:id/task-attachments", taskMetadataHandler.CreateAttachment)
	tasks.Get("/:id/checklist", checklistItemHandler.ListByTask)
	tasks.Post("/:id/checklist", checklistItemHandler.CreateChecklist)
	tasks.Get("/:id/checklists", checklistItemHandler.ListByTask)
	tasks.Post("/:id/checklists", checklistItemHandler.CreateChecklist)
	tasks.Get("/:id/assignees", taskHandler.ListAssignees)
	tasks.Put("/:id/archive", taskHandler.Archive)
	tasks.Post("/:id/archive", taskHandler.Archive)
	tasks.Put("/:id/restore", taskHandler.Restore)
	tasks.Post("/:id/restore", taskHandler.Restore)
	tasks.Get("/:id", taskHandler.GetByID)
	tasks.Put("/:id", taskHandler.Update)
	tasks.Delete("/:id", taskHandler.Delete)

	comments := api.Group("/comments", authMiddleware)
	comments.Put("/:id", commentHandler.Update)
	comments.Delete("/:id", commentHandler.Delete)

	taskLabels := api.Group("/task-labels", authMiddleware)
	taskLabels.Put("/:id", taskMetadataHandler.UpdateLabel)
	taskLabels.Delete("/:id", taskMetadataHandler.DeleteLabel)

	taskAttachments := api.Group("/task-attachments", authMiddleware)
	taskAttachments.Put("/:id", taskMetadataHandler.UpdateAttachment)
	taskAttachments.Delete("/:id", taskMetadataHandler.DeleteAttachment)

	notifications := api.Group("/notifications", authMiddleware)
	notifications.Get("/", notificationHandler.List)
	notifications.Put("/read-all", notificationHandler.MarkAllRead)
	notifications.Put("/:id/read", notificationHandler.MarkRead)

	changeRequests := api.Group("/change-requests", authMiddleware)
	changeRequests.Get("/:id", changeRequestHandler.GetByID)
	changeRequests.Post("/:id/approve", changeRequestHandler.Approve)
	changeRequests.Post("/:id/reject", changeRequestHandler.Reject)
	changeRequests.Post("/:id/cancel", changeRequestHandler.Cancel)

	taskAssignees := api.Group("/task-assignees", authMiddleware)
	taskAssignees.Get("/tasks/:id", taskHandler.ListAssignees)

	checklists := api.Group("/checklists", authMiddleware)
	checklists.Get("/tasks/:id", checklistItemHandler.ListByTask)
	checklists.Post("/tasks/:id", checklistItemHandler.CreateChecklist)
	checklists.Post("/:id/items", checklistItemHandler.CreateItem)
	checklists.Delete("/:id", checklistItemHandler.DeleteChecklist)

	checklistItems := api.Group("/checklist-items", authMiddleware)
	checklistItems.Put("/:id", checklistItemHandler.Update)
	checklistItems.Delete("/:id", checklistItemHandler.Delete)

	return app
}
