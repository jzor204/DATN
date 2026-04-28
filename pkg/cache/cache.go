package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type Service struct {
	client *redis.Client
}

func New(client *redis.Client) *Service {
	return &Service{
		client: client,
	}
}

func (s *Service) Get(ctx context.Context, key string) (string, error) {
	return s.client.Get(ctx, key).Result()
}

func (s *Service) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	return s.client.Set(ctx, key, value, ttl).Err()
}

func (s *Service) Delete(ctx context.Context, keys ...string) error {
	return s.client.Del(ctx, keys...).Err()
}
