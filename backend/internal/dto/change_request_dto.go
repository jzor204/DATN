package dto

type CreateTaskChangeRequestRequest struct {
	Title       *string           `json:"title"`
	Description *string           `json:"description"`
	Status      *string           `json:"status"`
	AssigneeIDs OptionalUintSlice `json:"assignee_ids"`
	Deadline    OptionalTime      `json:"deadline"`
	Reason      string            `json:"reason"`
}
