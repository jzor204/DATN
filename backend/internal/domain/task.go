package domain

import "time"

const (
	TaskStatusTodo       = "todo"
	TaskStatusInProgress = "in_progress"
	TaskStatusDone       = "done"
)

const (
	TaskPriorityNone   = "none"
	TaskPriorityLow    = "low"
	TaskPriorityMedium = "medium"
	TaskPriorityHigh   = "high"
	TaskPriorityUrgent = "urgent"
)

const (
	TaskArchiveFilterActive   = "active"
	TaskArchiveFilterArchived = "archived"
	TaskArchiveFilterAll      = "all"
)

type Task struct {
	ID          uint
	ProjectID   uint
	Title       string
	Description string
	Status      string
	Progress    int
	Priority    string
	AssigneeID  *uint
	AssigneeIDs []uint
	Deadline    *time.Time
	ReminderAt  *time.Time
	ArchivedAt  *time.Time
	ArchivedBy  *uint
	DeletedAt   *time.Time
	DeletedBy   *uint
	CreatedBy   uint
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
