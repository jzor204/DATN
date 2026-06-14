// @title Task Management API
// @version 1.0
// @description RESTful API cho há»‡ thá»‘ng Task Management
// @host localhost:8080
// @BasePath /api/v1
// @schemes http
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
package main

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"strings"

	docs "task-management/docs"
	deliveryhttp "task-management/internal/delivery/http"
	"task-management/internal/delivery/http/handler"
	"task-management/internal/delivery/http/middleware"
	"task-management/internal/delivery/http/realtime"
	"task-management/internal/repository"
	"task-management/internal/usecase"
	"task-management/pkg/cache"
	"task-management/pkg/config"
	"task-management/pkg/database"
	"task-management/pkg/utils"
)

func main() {
	cfg := config.Load()

	docs.SwaggerInfo.Title = "Task Management API"
	docs.SwaggerInfo.Description = "RESTful API cho há»‡ thá»‘ng Task Management"
	docs.SwaggerInfo.Version = "1.0"
	docs.SwaggerInfo.Host = swaggerHost(cfg)
	docs.SwaggerInfo.BasePath = "/api/v1"
	docs.SwaggerInfo.Schemes = swaggerSchemes(cfg)

	db, err := database.NewSQL(cfg)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	redisClient, err := database.NewRedis(cfg)
	if err != nil {
		log.Fatalf("failed to connect redis: %v", err)
	}

	cacheService := cache.New(redisClient)
	realtimeHub := realtime.NewHub()

	userRepo := repository.NewUserRepository(db)
	projectRepo := repository.NewProjectRepository(db)
	taskRepo := repository.NewTaskRepository(db)
	commentRepo := repository.NewCommentRepository(db)
	checklistRepo := repository.NewChecklistRepository(db)
	checklistItemRepo := repository.NewChecklistItemRepository(db)
	taskLabelRepo := repository.NewTaskLabelRepository(db)
	taskAttachmentRepo := repository.NewTaskAttachmentRepository(db)
	activityRepo := repository.NewActivityRepository(db)
	changeRequestRepo := repository.NewTaskChangeRequestRepository(db)
	notificationRepo := repository.NewNotificationRepository(db)

	passwordService := utils.NewPasswordService()
	jwtService := utils.NewJWTService(cfg.JWTSecret, cfg.JWTAccessTokenExpireHours)

	if err := bootstrapAdmin(context.Background(), cfg, userRepo, passwordService); err != nil {
		log.Fatalf("failed to bootstrap admin: %v", err)
	}

	authUsecase := usecase.NewAuthUsecase(
		userRepo,
		passwordService,
		jwtService,
		cacheService,
	)

	accessService := usecase.NewAccessService(projectRepo)

	projectUsecase := usecase.NewProjectUsecase(
		projectRepo,
		userRepo,
		accessService,
		cacheService,
	)

	taskUsecase := usecase.NewTaskUsecase(
		taskRepo,
		projectRepo,
		userRepo,
		accessService,
		cacheService,
	)

	commentUsecase := usecase.NewCommentUsecase(
		commentRepo,
		taskRepo,
		accessService,
		cacheService,
	)

	checklistItemUsecase := usecase.NewChecklistItemUsecase(
		checklistRepo,
		checklistItemRepo,
		taskRepo,
		accessService,
		cacheService,
	)

	taskMetadataUsecase := usecase.NewTaskMetadataUsecase(
		taskLabelRepo,
		taskAttachmentRepo,
		taskRepo,
		accessService,
		cacheService,
	)

	activityUsecase := usecase.NewActivityUsecase(
		activityRepo,
		taskRepo,
		userRepo,
		accessService,
		cacheService,
	)

	notificationUsecase := usecase.NewNotificationUsecase(
		notificationRepo,
		changeRequestRepo,
		cacheService,
	)

	changeRequestUsecase := usecase.NewTaskChangeRequestUsecase(
		changeRequestRepo,
		notificationRepo,
		taskRepo,
		projectRepo,
		userRepo,
		taskUsecase,
		accessService,
		cacheService,
	)
	taskUsecase.SetActivityUsecase(activityUsecase)
	commentUsecase.SetActivityUsecase(activityUsecase)
	checklistItemUsecase.SetActivityUsecase(activityUsecase)
	taskMetadataUsecase.SetActivityUsecase(activityUsecase)
	changeRequestUsecase.SetActivityUsecase(activityUsecase)

	authHandler := handler.NewAuthHandler(authUsecase)
	projectHandler := handler.NewProjectHandler(projectUsecase, realtimeHub)
	taskHandler := handler.NewTaskHandler(taskUsecase, projectUsecase, realtimeHub)
	commentHandler := handler.NewCommentHandler(commentUsecase, taskUsecase, realtimeHub)
	checklistItemHandler := handler.NewChecklistItemHandler(checklistItemUsecase, taskUsecase, realtimeHub)
	taskMetadataHandler := handler.NewTaskMetadataHandler(taskMetadataUsecase, realtimeHub)
	activityHandler := handler.NewActivityHandler(activityUsecase)
	notificationHandler := handler.NewNotificationHandler(notificationUsecase)
	changeRequestHandler := handler.NewChangeRequestHandler(changeRequestUsecase, realtimeHub)
	wsHandler := handler.NewWebSocketHandler(realtimeHub, jwtService, projectUsecase, taskUsecase)

	app := deliveryhttp.NewRouter(
		authHandler,
		projectHandler,
		taskHandler,
		commentHandler,
		checklistItemHandler,
		taskMetadataHandler,
		activityHandler,
		notificationHandler,
		changeRequestHandler,
		wsHandler,
		middleware.AuthMiddleware(jwtService),
	)

	log.Printf("app: %s", cfg.AppName)
	log.Printf("env: %s", cfg.AppEnv)
	log.Printf("server is running on port %s", cfg.AppPort)

	if err := app.Listen(":" + cfg.AppPort); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}

func swaggerHost(cfg *config.Config) string {
	host := strings.TrimSpace(cfg.SwaggerHost)
	if host != "" {
		if parsedURL, err := url.Parse(host); err == nil && parsedURL.Host != "" {
			return parsedURL.Host
		}
		return strings.TrimSuffix(host, "/")
	}

	return "localhost:" + cfg.AppPort
}

func swaggerSchemes(cfg *config.Config) []string {
	rawSchemes := strings.Split(cfg.SwaggerSchemes, ",")
	schemes := make([]string, 0, len(rawSchemes))

	for _, rawScheme := range rawSchemes {
		scheme := strings.TrimSpace(rawScheme)
		if scheme != "" {
			schemes = append(schemes, scheme)
		}
	}

	if len(schemes) == 0 {
		return []string{"http"}
	}

	return schemes
}

func bootstrapAdmin(
	ctx context.Context,
	cfg *config.Config,
	userRepo *repository.UserRepository,
	passwordService *utils.PasswordService,
) error {
	password := strings.TrimSpace(cfg.BootstrapAdminPassword)
	if password == "" {
		return nil
	}
	if len(password) < 6 {
		return fmt.Errorf("BOOTSTRAP_ADMIN_PASSWORD must be at least 6 characters")
	}

	name := strings.TrimSpace(cfg.BootstrapAdminName)
	if name == "" {
		name = "Admin User"
	}

	email := strings.ToLower(strings.TrimSpace(cfg.BootstrapAdminEmail))
	if email == "" {
		return fmt.Errorf("BOOTSTRAP_ADMIN_EMAIL is required")
	}

	hashedPassword, err := passwordService.Hash(password)
	if err != nil {
		return err
	}

	userID, err := userRepo.UpsertBootstrapAdmin(ctx, name, email, hashedPassword)
	if err != nil {
		return err
	}

	log.Printf("bootstrap admin ensured: %s (#%d)", email, userID)
	return nil
}
