package domain

import "time"

const (
	TaskStatusTodo       = "todo"
	TaskStatusInProgress = "in_progress"
	TaskStatusDone       = "done"
)

type Task struct {
	ID          uint
	ProjectID   uint
	Title       string
	Description string
	Status      string
	Progress    int
	AssigneeID  *uint
	AssigneeIDs []uint
	Deadline    *time.Time
	CreatedBy   uint
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
