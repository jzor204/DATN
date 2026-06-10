package domain

import "time"

const (
	ProjectRoleOwner  = "owner"
	ProjectRoleAdmin  = "admin"
	ProjectRoleMember = "member"
)

type ProjectMember struct {
	ID            uint
	ProjectID     uint
	UserID        uint
	RoleInProject string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
