package utils

import (
	"errors"
	"time"

	"task-management/internal/usecase/interfaces"

	"github.com/golang-jwt/jwt/v5"
)

type JWTService struct {
	secret      string
	expireHours int
}

type customClaims struct {
	UserID     uint   `json:"user_id"`
	Email      string `json:"email"`
	GlobalRole string `json:"global_role"`
	jwt.RegisteredClaims
}

func NewJWTService(secret string, expireHours int) *JWTService {
	if expireHours <= 0 {
		expireHours = 24
	}

	return &JWTService{
		secret:      secret,
		expireHours: expireHours,
	}
}

func (s *JWTService) GenerateAccessToken(claims interfaces.AuthClaims) (string, error) {
	now := time.Now()
	expireAt := now.Add(time.Duration(s.expireHours) * time.Hour)

	tokenClaims := customClaims{
		UserID:     claims.UserID,
		Email:      claims.Email,
		GlobalRole: claims.GlobalRole,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expireAt),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, tokenClaims)

	return token.SignedString([]byte(s.secret))
}

func (s *JWTService) ParseAccessToken(tokenString string) (*interfaces.AuthClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &customClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return []byte(s.secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*customClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return &interfaces.AuthClaims{
		UserID:     claims.UserID,
		Email:      claims.Email,
		GlobalRole: claims.GlobalRole,
	}, nil
}
