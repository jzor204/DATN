package dto

type CreateTaskLabelRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type UpdateTaskLabelRequest struct {
	Name  *string `json:"name"`
	Color *string `json:"color"`
}

type CreateTaskAttachmentRequest struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type UpdateTaskAttachmentRequest struct {
	Name *string `json:"name"`
	URL  *string `json:"url"`
}
