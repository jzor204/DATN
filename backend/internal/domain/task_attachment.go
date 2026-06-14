package domain

import "time"

type TaskAttachment struct {
	ID        uint
	TaskID    uint
	Name      string
	URL       string
	CreatedBy uint
	CreatedAt time.Time
	UpdatedAt time.Time
}
