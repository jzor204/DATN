package dto

type PaginationRequest struct {
	Page     int `query:"page"`
	PageSize int `query:"page_size"`
}

type PaginationResponse struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	Total      int64 `json:"total"`
	TotalPages int64 `json:"total_pages"`
}
