package dto

type CreateTaskRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	AssigneeID  *uint  `json:"assignee_id"`
}

type UpdateTaskRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	AssigneeID  *uint   `json:"assignee_id"`
}
