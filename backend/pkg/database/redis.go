package database

import (
	"context"
	"fmt"
	"strings"

	"task-management/pkg/config"

	"github.com/redis/go-redis/v9"
)

func NewRedis(cfg *config.Config) (*redis.Client, error) {
	var options *redis.Options
	if strings.TrimSpace(cfg.RedisURL) != "" {
		parsedOptions, err := redis.ParseURL(cfg.RedisURL)
		if err != nil {
			return nil, err
		}
		options = parsedOptions
	} else {
		options = &redis.Options{
			Addr:     fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
			Password: cfg.RedisPassword,
			DB:       cfg.RedisDB,
		}
	}

	client := redis.NewClient(options)

	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}

	return client, nil
}
