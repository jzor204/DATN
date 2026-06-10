package domain

import "time"

type Comment struct {
	ID        uint
	TaskID    uint
	AuthorID  uint
	Content   string
	CreatedAt time.Time
	UpdatedAt time.Time
}
