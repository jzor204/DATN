package dto

type CreateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type AddProjectMemberRequest struct {
	UserID        uint   `json:"user_id"`
	RoleInProject string `json:"role_in_project"`
}
