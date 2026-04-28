package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

var loadEnvOnce sync.Once

type Config struct {
	AppName string
	AppEnv  string
	AppPort string

	MySQLHost     string
	MySQLPort     string
	MySQLUser     string
	MySQLPassword string
	MySQLDatabase string

	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int

	JWTSecret                 string
	JWTAccessTokenExpireHours int
}

func Load() *Config {
	loadDotEnv()

	return &Config{
		AppName: getEnv("APP_NAME", "task-management"),
		AppEnv:  getEnv("APP_ENV", "development"),
		AppPort: getEnv("APP_PORT", "8080"),

		MySQLHost:     getEnv("MYSQL_HOST", "127.0.0.1"),
		MySQLPort:     getEnv("MYSQL_PORT", "3306"),
		MySQLUser:     getEnv("MYSQL_USER", "root"),
		MySQLPassword: getEnv("MYSQL_PASSWORD", "root"),
		MySQLDatabase: getEnv("MYSQL_DATABASE", "task_management"),

		RedisHost:     getEnv("REDIS_HOST", "127.0.0.1"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),

		JWTSecret:                 getEnv("JWT_SECRET", "super-secret-key"),
		JWTAccessTokenExpireHours: getEnvAsInt("JWT_ACCESS_TOKEN_EXPIRE_HOURS", 24),
	}
}

func loadDotEnv() {
	loadEnvOnce.Do(func() {
		wd, err := os.Getwd()
		if err != nil {
			return
		}

		dir := wd
		for {
			if loadEnvFile(filepath.Join(dir, ".env")) {
				return
			}

			parent := filepath.Dir(dir)
			if parent == dir {
				return
			}

			dir = parent
		}
	})
}

func loadEnvFile(path string) bool {
	file, err := os.Open(path)
	if err != nil {
		return false
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		line = strings.TrimPrefix(line, "export ")
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"'`)

		if key == "" {
			continue
		}

		if _, exists := os.LookupEnv(key); exists {
			continue
		}

		_ = os.Setenv(key, value)
	}

	return true
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getEnvAsInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	number, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return number
}
