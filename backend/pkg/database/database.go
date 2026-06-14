package database

import (
	"fmt"
	"strings"

	"task-management/pkg/config"

	"gorm.io/gorm"
)

func NewSQL(cfg *config.Config) (*gorm.DB, error) {
	switch normalizeDriver(cfg.DBDriver) {
	case "postgres":
		return NewPostgres(cfg)
	case "mysql":
		return NewMySQL(cfg)
	default:
		return nil, fmt.Errorf("unsupported DB_DRIVER %q", cfg.DBDriver)
	}
}

func normalizeDriver(driver string) string {
	switch strings.ToLower(strings.TrimSpace(driver)) {
	case "", "mysql":
		return "mysql"
	case "postgres", "postgresql", "pg", "pgx":
		return "postgres"
	default:
		return strings.ToLower(strings.TrimSpace(driver))
	}
}
