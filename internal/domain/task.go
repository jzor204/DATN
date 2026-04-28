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
	AssigneeID  *uint
	CreatedBy   uint
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
