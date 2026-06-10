package domain

import "time"

const (
	TaskChangeRequestStatusPending  = "pending"
	TaskChangeRequestStatusApproved = "approved"
	TaskChangeRequestStatusRejected = "rejected"
)

type TaskChangeRequest struct {
	ID          uint
	TaskID      uint
	ProjectID   uint
	RequestedBy uint
	PayloadJSON string
	Reason      string
	Status      string
	ReviewedBy  *uint
	ReviewedAt  *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
