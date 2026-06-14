package domain

import "time"

type TaskLabel struct {
	ID        uint
	TaskID    uint
	Name      string
	Color     string
	CreatedBy uint
	CreatedAt time.Time
	UpdatedAt time.Time
}
