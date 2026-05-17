package dto

import "time"

type ErrorResponse struct {
	Success bool   `json:"success" example:"false"`
	Message string `json:"message" example:"request failed"`
	Error   string `json:"error" example:"invalid request body"`
}

type SimpleSuccessResponse struct {
	Success bool   `json:"success" example:"true"`
	Message string `json:"message" example:"delete success"`
}

type AuthData struct {
	AccessToken string `json:"access_token" example:"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."`
}

type AuthSuccessResponse struct {
	Success bool     `json:"success" example:"true"`
	Message string   `json:"message" example:"login success"`
	Data    AuthData `json:"data"`
}

type MeData struct {
	ID        uint      `json:"id" example:"1"`
	Name      string    `json:"name" example:"Le Anh"`
	Email     string    `json:"email" example:"leanh@example.com"`
	Role      string    `json:"role" example:"member"`
	CreatedAt time.Time `json:"created_at"`
}

type MeSuccessResponse struct {
	Success bool   `json:"success" example:"true"`
	Message string `json:"message" example:"get profile success"`
	Data    MeData `json:"data"`
}

type ProjectData struct {
	ID          uint      `json:"id" example:"1"`
	Name        string    `json:"name" example:"Project Alpha"`
	Description string    `json:"description" example:"Project dau tien"`
	OwnerID     uint      `json:"owner_id" example:"1"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProjectSuccessResponse struct {
	Success bool        `json:"success" example:"true"`
	Message string      `json:"message" example:"create project success"`
	Data    ProjectData `json:"data"`
}

type SwaggerPaginationResponse struct {
	Page       int   `json:"page" example:"1"`
	PageSize   int   `json:"page_size" example:"10"`
	Total      int64 `json:"total" example:"25"`
	TotalPages int   `json:"total_pages" example:"3"`
}

type ProjectListPayload struct {
	Data       []ProjectData             `json:"data"`
	Pagination SwaggerPaginationResponse `json:"pagination"`
}

type ProjectListSuccessResponse struct {
	Success bool               `json:"success" example:"true"`
	Message string             `json:"message" example:"get projects success"`
	Data    ProjectListPayload `json:"data"`
}

type ProjectMemberData struct {
	UserID        uint      `json:"user_id" example:"2"`
	Name          string    `json:"name" example:"Nguyen Van B"`
	Email         string    `json:"email" example:"b@example.com"`
	RoleInProject string    `json:"role_in_project" example:"member"`
	JoinedAt      time.Time `json:"joined_at"`
}

type ProjectMemberSuccessResponse struct {
	Success bool              `json:"success" example:"true"`
	Message string            `json:"message" example:"add project member success"`
	Data    ProjectMemberData `json:"data"`
}

type ProjectMemberListPayload struct {
	Data       []ProjectMemberData       `json:"data"`
	Pagination SwaggerPaginationResponse `json:"pagination"`
}

type ProjectMemberListSuccessResponse struct {
	Success bool                     `json:"success" example:"true"`
	Message string                   `json:"message" example:"get project members success"`
	Data    ProjectMemberListPayload `json:"data"`
}

type ProjectMemberCandidateData struct {
	UserID    uint      `json:"user_id" example:"4"`
	Name      string    `json:"name" example:"Tran Van C"`
	Email     string    `json:"email" example:"c@example.com"`
	Role      string    `json:"role" example:"member"`
	CreatedAt time.Time `json:"created_at"`
}

type ProjectMemberCandidateListPayload struct {
	Data       []ProjectMemberCandidateData `json:"data"`
	Pagination SwaggerPaginationResponse    `json:"pagination"`
}

type ProjectMemberCandidateListSuccessResponse struct {
	Success bool                              `json:"success" example:"true"`
	Message string                            `json:"message" example:"get member candidates success"`
	Data    ProjectMemberCandidateListPayload `json:"data"`
}

type TaskData struct {
	ID          uint      `json:"id" example:"1"`
	ProjectID   uint      `json:"project_id" example:"1"`
	ProjectName string    `json:"project_name,omitempty" example:"Website Redesign"`
	Title       string    `json:"title" example:"Task 1"`
	Description string    `json:"description" example:"Mo ta task"`
	Status      string    `json:"status" example:"todo"`
	AssigneeID  *uint     `json:"assignee_id" example:"2"`
	CreatedBy   uint      `json:"created_by" example:"1"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type TaskSuccessResponse struct {
	Success bool     `json:"success" example:"true"`
	Message string   `json:"message" example:"create task success"`
	Data    TaskData `json:"data"`
}

type TaskListPayload struct {
	Data       []TaskData                `json:"data"`
	Pagination SwaggerPaginationResponse `json:"pagination"`
}

type TaskListSuccessResponse struct {
	Success bool            `json:"success" example:"true"`
	Message string          `json:"message" example:"get tasks success"`
	Data    TaskListPayload `json:"data"`
}

type CommentData struct {
	ID        uint      `json:"id" example:"1"`
	TaskID    uint      `json:"task_id" example:"1"`
	AuthorID  uint      `json:"author_id" example:"1"`
	Content   string    `json:"content" example:"Task nay can lam gap"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CommentSuccessResponse struct {
	Success bool        `json:"success" example:"true"`
	Message string      `json:"message" example:"create comment success"`
	Data    CommentData `json:"data"`
}

type CommentListPayload struct {
	Data       []CommentData             `json:"data"`
	Pagination SwaggerPaginationResponse `json:"pagination"`
}

type CommentListSuccessResponse struct {
	Success bool               `json:"success" example:"true"`
	Message string             `json:"message" example:"get comments success"`
	Data    CommentListPayload `json:"data"`
}
