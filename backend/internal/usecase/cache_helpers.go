package usecase

import (
	"context"
	"encoding/json"
	"time"

	"task-management/internal/usecase/interfaces"
)

const readCacheTTL = 45 * time.Second

func getCachedJSON(ctx context.Context, cacheService interfaces.CacheService, key string, dest interface{}) bool {
	if cacheService == nil || key == "" || dest == nil {
		return false
	}

	raw, err := cacheService.Get(ctx, key)
	if err != nil || raw == "" {
		return false
	}

	return json.Unmarshal([]byte(raw), dest) == nil
}

func setCachedJSON(ctx context.Context, cacheService interfaces.CacheService, key string, value interface{}, ttl time.Duration) {
	if cacheService == nil || key == "" || value == nil {
		return
	}

	if ttl <= 0 {
		ttl = readCacheTTL
	}

	payload, err := json.Marshal(value)
	if err != nil {
		return
	}

	_ = cacheService.Set(ctx, key, payload, ttl)
}

func deleteCacheKeys(ctx context.Context, cacheService interfaces.CacheService, keys ...string) {
	if cacheService == nil || len(keys) == 0 {
		return
	}

	_ = cacheService.Delete(ctx, keys...)
}

func deleteCachePatterns(ctx context.Context, cacheService interfaces.CacheService, patterns ...string) {
	if cacheService == nil || len(patterns) == 0 {
		return
	}

	for _, pattern := range patterns {
		if pattern == "" {
			continue
		}
		_ = cacheService.DeleteByPattern(ctx, pattern)
	}
}
