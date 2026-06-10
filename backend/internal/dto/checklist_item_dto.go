package dto

type CreateChecklistRequest struct {
	Title string `json:"title"`
}

type CreateChecklistItemRequest struct {
	Title string `json:"title"`
}

type UpdateChecklistItemRequest struct {
	Title  *string `json:"title"`
	IsDone *bool   `json:"is_done"`
}
