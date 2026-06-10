package domain

import "time"

type Checklist struct {
	ID        uint
	TaskID    uint
	Title     string
	Position  int
	CreatedBy uint
	CreatedAt time.Time
	UpdatedAt time.Time
	Items     []*ChecklistItem
}
