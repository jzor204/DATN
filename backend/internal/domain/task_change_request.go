package domain

import "time"

const (
	TaskChangeRequestStatusPending  = "pending"
	TaskChangeRequestStatusApproved = "approved"
	TaskChangeRequestStatusRejected = "rejected"
	TaskChangeRequestStatusCanceled = "cancelled"
)

type TaskChangeRequest struct {
	ID            uint
	TaskID        uint
	ProjectID     uint
	RequestedBy   uint
	PayloadJSON   string
	Reason        string
	TaskUpdatedAt *time.Time
	Status        string
	ReviewedBy    *uint
	ReviewedAt    *time.Time
	ReviewNote    string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}
