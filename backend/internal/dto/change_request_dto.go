package dto

type CreateTaskChangeRequestRequest struct {
	Title       *string           `json:"title"`
	Description *string           `json:"description"`
	Status      *string           `json:"status"`
	Priority    *string           `json:"priority"`
	AssigneeIDs OptionalUintSlice `json:"assignee_ids"`
	Deadline    OptionalTime      `json:"deadline"`
	ReminderAt  OptionalTime      `json:"reminder_at"`
	Reason      string            `json:"reason"`
}

type ReviewTaskChangeRequestRequest struct {
	ReviewNote string `json:"review_note"`
}
