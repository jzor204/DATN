package domain

import "time"

type Project struct {
	ID          uint
	Name        string
	Description string
	OwnerID     uint
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
