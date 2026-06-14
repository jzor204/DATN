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

	DBDriver    string
	DatabaseURL string

	MySQLHost     string
	MySQLPort     string
	MySQLUser     string
	MySQLPassword string
	MySQLDatabase string

	RedisURL      string
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int

	JWTSecret                 string
	JWTAccessTokenExpireHours int

	SwaggerHost    string
	SwaggerSchemes string
}

func Load() *Config {
	loadDotEnv()

	databaseURL := getEnv("DATABASE_URL", "")
	dbDriver := strings.ToLower(getEnv("DB_DRIVER", ""))
	if dbDriver == "" {
		dbDriver = inferDBDriver(databaseURL)
	}

	return &Config{
		AppName: getEnv("APP_NAME", "task-management"),
		AppEnv:  getEnv("APP_ENV", "development"),
		AppPort: getEnvAny("8080", "APP_PORT", "PORT"),

		DBDriver:    dbDriver,
		DatabaseURL: databaseURL,

		MySQLHost:     getEnv("MYSQL_HOST", "127.0.0.1"),
		MySQLPort:     getEnv("MYSQL_PORT", "3306"),
		MySQLUser:     getEnv("MYSQL_USER", "root"),
		MySQLPassword: getEnv("MYSQL_PASSWORD", "root"),
		MySQLDatabase: getEnv("MYSQL_DATABASE", "task_management"),

		RedisURL:      getEnv("REDIS_URL", ""),
		RedisHost:     getEnv("REDIS_HOST", "127.0.0.1"),
		RedisPort:     getEnv("REDIS_PORT", "6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvAsInt("REDIS_DB", 0),

		JWTSecret:                 getEnv("JWT_SECRET", "super-secret-key"),
		JWTAccessTokenExpireHours: getEnvAsInt("JWT_ACCESS_TOKEN_EXPIRE_HOURS", 24),

		SwaggerHost:    getEnvAny("", "SWAGGER_HOST", "RENDER_EXTERNAL_HOSTNAME", "RENDER_EXTERNAL_URL"),
		SwaggerSchemes: getEnv("SWAGGER_SCHEMES", "http"),
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

func getEnvAny(fallback string, keys ...string) string {
	for _, key := range keys {
		value := os.Getenv(key)
		if value != "" {
			return value
		}
	}
	return fallback
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

func inferDBDriver(databaseURL string) string {
	normalizedURL := strings.ToLower(strings.TrimSpace(databaseURL))
	if strings.HasPrefix(normalizedURL, "postgres://") || strings.HasPrefix(normalizedURL, "postgresql://") {
		return "postgres"
	}
	return "mysql"
}
