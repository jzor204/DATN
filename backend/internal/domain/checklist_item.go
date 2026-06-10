package domain

import "time"

type ChecklistItem struct {
	ID          uint
	ChecklistID uint
	TaskID      uint
	Title       string
	IsDone      bool
	Position    int
	CreatedBy   uint
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
