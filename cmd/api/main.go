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
	"log"

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
	docs.SwaggerInfo.Host = "localhost:" + cfg.AppPort
	docs.SwaggerInfo.BasePath = "/api/v1"
	docs.SwaggerInfo.Schemes = []string{"http"}

	db, err := database.NewMySQL(cfg)
	if err != nil {
		log.Fatalf("failed to connect mysql: %v", err)
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

	passwordService := utils.NewPasswordService()
	jwtService := utils.NewJWTService(cfg.JWTSecret, cfg.JWTAccessTokenExpireHours)

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
	)

	taskUsecase := usecase.NewTaskUsecase(
		taskRepo,
		projectRepo,
		userRepo,
		accessService,
	)

	commentUsecase := usecase.NewCommentUsecase(
		commentRepo,
		taskRepo,
		accessService,
	)

	authHandler := handler.NewAuthHandler(authUsecase)
	projectHandler := handler.NewProjectHandler(projectUsecase, realtimeHub)
	taskHandler := handler.NewTaskHandler(taskUsecase, projectUsecase, realtimeHub)
	commentHandler := handler.NewCommentHandler(commentUsecase, taskUsecase, realtimeHub)
	wsHandler := handler.NewWebSocketHandler(realtimeHub, jwtService, projectUsecase, taskUsecase)

	app := deliveryhttp.NewRouter(
		authHandler,
		projectHandler,
		taskHandler,
		commentHandler,
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
