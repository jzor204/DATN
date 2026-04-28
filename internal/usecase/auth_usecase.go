package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"task-management/internal/domain"
	"task-management/internal/usecase/interfaces"
)

const userProfileCacheTTL = 5 * time.Minute

type AuthUsecase struct {
	userRepo        interfaces.UserRepository
	passwordService interfaces.PasswordService
	jwtService      interfaces.JWTService
	cacheService    interfaces.CacheService
}

type RegisterInput struct {
	Name     string
	Email    string
	Password string
}

type LoginInput struct {
	Email    string
	Password string
}

type AuthOutput struct {
	AccessToken string `json:"access_token"`
}

type MeOutput struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

func NewAuthUsecase(
	userRepo interfaces.UserRepository,
	passwordService interfaces.PasswordService,
	jwtService interfaces.JWTService,
	cacheService interfaces.CacheService,
) *AuthUsecase {
	return &AuthUsecase{
		userRepo:        userRepo,
		passwordService: passwordService,
		jwtService:      jwtService,
		cacheService:    cacheService,
	}
}

func (uc *AuthUsecase) Register(ctx context.Context, input RegisterInput) (*AuthOutput, error) {
	name := strings.TrimSpace(input.Name)
	email := strings.ToLower(strings.TrimSpace(input.Email))
	password := strings.TrimSpace(input.Password)

	if name == "" {
		return nil, errors.New("name is required")
	}
	if email == "" {
		return nil, errors.New("email is required")
	}
	if password == "" {
		return nil, errors.New("password is required")
	}
	if len(password) < 6 {
		return nil, errors.New("password must be at least 6 characters")
	}

	existingUser, err := uc.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if existingUser != nil {
		return nil, errors.New("email already exists")
	}

	hashedPassword, err := uc.passwordService.Hash(password)
	if err != nil {
		return nil, err
	}

	user := &domain.User{
		Name:         name,
		Email:        email,
		PasswordHash: hashedPassword,
		Role:         domain.UserRoleMember,
	}

	if err := uc.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	accessToken, err := uc.jwtService.GenerateAccessToken(interfaces.AuthClaims{
		UserID:     user.ID,
		Email:      user.Email,
		GlobalRole: user.Role,
	})
	if err != nil {
		return nil, err
	}

	return &AuthOutput{
		AccessToken: accessToken,
	}, nil
}

func (uc *AuthUsecase) Login(ctx context.Context, input LoginInput) (*AuthOutput, error) {
	email := strings.ToLower(strings.TrimSpace(input.Email))
	password := strings.TrimSpace(input.Password)

	if email == "" {
		return nil, errors.New("email is required")
	}
	if password == "" {
		return nil, errors.New("password is required")
	}

	user, err := uc.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("invalid email or password")
	}

	if err := uc.passwordService.Compare(user.PasswordHash, password); err != nil {
		return nil, errors.New("invalid email or password")
	}

	accessToken, err := uc.jwtService.GenerateAccessToken(interfaces.AuthClaims{
		UserID:     user.ID,
		Email:      user.Email,
		GlobalRole: user.Role,
	})
	if err != nil {
		return nil, err
	}

	return &AuthOutput{
		AccessToken: accessToken,
	}, nil
}

func (uc *AuthUsecase) Me(ctx context.Context, userID uint) (*MeOutput, error) {
	if userID == 0 {
		return nil, errors.New("invalid user id")
	}

	cacheKey := fmt.Sprintf("user:%d:profile", userID)

	if cachedValue, err := uc.cacheService.Get(ctx, cacheKey); err == nil && cachedValue != "" {
		var cachedProfile MeOutput
		if err := json.Unmarshal([]byte(cachedValue), &cachedProfile); err == nil {
			return &cachedProfile, nil
		}
	}

	user, err := uc.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if user == nil {
		return nil, errors.New("user not found")
	}

	profile := &MeOutput{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}

	if raw, err := json.Marshal(profile); err == nil {
		_ = uc.cacheService.Set(ctx, cacheKey, raw, userProfileCacheTTL)
	}

	return profile, nil
}
