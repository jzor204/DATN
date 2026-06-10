package domain

import "time"

const (
	NotificationTypeTaskChangeRequest         = "task_change_request"
	NotificationTypeTaskChangeRequestApproved = "task_change_request_approved"
	NotificationTypeTaskChangeRequestRejected = "task_change_request_rejected"
)

type Notification struct {
	ID          uint
	UserID      uint
	ActorID     *uint
	Type        string
	Title       string
	Message     string
	PayloadJSON string
	ReadAt      *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
