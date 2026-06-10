package domain

import "time"

const (
	UserRoleAdmin  = "admin"
	UserRoleMember = "member"
)

type User struct {
	ID           uint
	Name         string
	Email        string
	PasswordHash string
	Role         string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}
