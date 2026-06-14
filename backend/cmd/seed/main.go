package main

import (
	"context"
	"errors"
	"log"

	"task-management/pkg/config"
	"task-management/pkg/database"
	"task-management/pkg/utils"

	"gorm.io/gorm"
)

type seedUser struct {
	ID           uint   `gorm:"column:id;primaryKey;autoIncrement"`
	Name         string `gorm:"column:name"`
	Email        string `gorm:"column:email"`
	PasswordHash string `gorm:"column:password_hash"`
	Role         string `gorm:"column:role"`
}

func (seedUser) TableName() string {
	return "users"
}

type seedProject struct {
	ID          uint   `gorm:"column:id;primaryKey;autoIncrement"`
	Name        string `gorm:"column:name"`
	Description string `gorm:"column:description"`
	OwnerID     uint   `gorm:"column:owner_id"`
}

func (seedProject) TableName() string {
	return "projects"
}

type seedProjectMember struct {
	ID            uint   `gorm:"column:id;primaryKey;autoIncrement"`
	ProjectID     uint   `gorm:"column:project_id"`
	UserID        uint   `gorm:"column:user_id"`
	RoleInProject string `gorm:"column:role_in_project"`
}

func (seedProjectMember) TableName() string {
	return "project_members"
}

type seedTask struct {
	ID          uint   `gorm:"column:id;primaryKey;autoIncrement"`
	ProjectID   uint   `gorm:"column:project_id"`
	Title       string `gorm:"column:title"`
	Description string `gorm:"column:description"`
	Status      string `gorm:"column:status"`
	AssigneeID  *uint  `gorm:"column:assignee_id"`
	CreatedBy   uint   `gorm:"column:created_by"`
}

func (seedTask) TableName() string {
	return "tasks"
}

type seedComment struct {
	ID       uint   `gorm:"column:id;primaryKey;autoIncrement"`
	TaskID   uint   `gorm:"column:task_id"`
	AuthorID uint   `gorm:"column:author_id"`
	Content  string `gorm:"column:content"`
}

func (seedComment) TableName() string {
	return "comments"
}

func main() {
	cfg := config.Load()

	db, err := database.NewSQL(cfg)
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	passwordService := utils.NewPasswordService()
	ctx := context.Background()

	if err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		adminID, err := ensureUser(tx, passwordService, "Admin User", "admin@example.com", "123456", "admin")
		if err != nil {
			return err
		}

		memberAID, err := ensureUser(tx, passwordService, "Member A", "membera@example.com", "123456", "member")
		if err != nil {
			return err
		}

		memberBID, err := ensureUser(tx, passwordService, "Member B", "memberb@example.com", "123456", "member")
		if err != nil {
			return err
		}

		projectID, err := ensureProject(
			tx,
			"Project Alpha",
			"Project demo dau tien cua he thong task management",
			adminID,
		)
		if err != nil {
			return err
		}

		if err := ensureProjectMember(tx, projectID, adminID, "owner"); err != nil {
			return err
		}
		if err := ensureProjectMember(tx, projectID, memberAID, "admin"); err != nil {
			return err
		}
		if err := ensureProjectMember(tx, projectID, memberBID, "member"); err != nil {
			return err
		}

		task1ID, err := ensureTask(
			tx,
			projectID,
			"Thiet ke API auth",
			"Tao register, login, me",
			"todo",
			&memberAID,
			adminID,
		)
		if err != nil {
			return err
		}

		task2ID, err := ensureTask(
			tx,
			projectID,
			"Hoan thien module task",
			"Tao CRUD task + pagination",
			"in_progress",
			&memberBID,
			adminID,
		)
		if err != nil {
			return err
		}

		if err := ensureComment(tx, task1ID, adminID, "Uu tien lam auth truoc de test cac route protected."); err != nil {
			return err
		}
		if err := ensureComment(tx, task1ID, memberAID, "Da bat dau lam phan login va middleware JWT."); err != nil {
			return err
		}
		if err := ensureComment(tx, task2ID, memberBID, "Dang lam phan update status va assign task."); err != nil {
			return err
		}

		return nil
	}); err != nil {
		log.Fatalf("seed failed: %v", err)
	}

	log.Println("seed success")
}

func ensureUser(
	tx *gorm.DB,
	passwordService *utils.PasswordService,
	name string,
	email string,
	password string,
	role string,
) (uint, error) {
	var existing seedUser

	findErr := tx.Where("email = ?", email).First(&existing).Error
	if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
		return 0, findErr
	}

	hashedPassword, hashErr := passwordService.Hash(password)
	if hashErr != nil {
		return 0, hashErr
	}

	if errors.Is(findErr, gorm.ErrRecordNotFound) {
		row := seedUser{
			Name:         name,
			Email:        email,
			PasswordHash: hashedPassword,
			Role:         role,
		}
		if err := tx.Create(&row).Error; err != nil {
			return 0, err
		}
		return row.ID, nil
	}

	if err := tx.Model(&seedUser{}).
		Where("id = ?", existing.ID).
		Updates(map[string]interface{}{
			"name":          name,
			"password_hash": hashedPassword,
			"role":          role,
		}).Error; err != nil {
		return 0, err
	}

	return existing.ID, nil
}

func ensureProject(
	tx *gorm.DB,
	name string,
	description string,
	ownerID uint,
) (uint, error) {
	var existing seedProject

	err := tx.Where("name = ?", name).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := seedProject{
			Name:        name,
			Description: description,
			OwnerID:     ownerID,
		}
		if err := tx.Create(&row).Error; err != nil {
			return 0, err
		}
		return row.ID, nil
	}

	if err := tx.Model(&seedProject{}).
		Where("id = ?", existing.ID).
		Updates(map[string]interface{}{
			"description": description,
			"owner_id":    ownerID,
		}).Error; err != nil {
		return 0, err
	}

	return existing.ID, nil
}

func ensureProjectMember(
	tx *gorm.DB,
	projectID uint,
	userID uint,
	roleInProject string,
) error {
	var existing seedProjectMember

	err := tx.Where("project_id = ? AND user_id = ?", projectID, userID).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := seedProjectMember{
			ProjectID:     projectID,
			UserID:        userID,
			RoleInProject: roleInProject,
		}
		return tx.Create(&row).Error
	}

	return tx.Model(&seedProjectMember{}).
		Where("id = ?", existing.ID).
		Update("role_in_project", roleInProject).Error
}

func ensureTask(
	tx *gorm.DB,
	projectID uint,
	title string,
	description string,
	status string,
	assigneeID *uint,
	createdBy uint,
) (uint, error) {
	var existing seedTask

	err := tx.Where("project_id = ? AND title = ?", projectID, title).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := seedTask{
			ProjectID:   projectID,
			Title:       title,
			Description: description,
			Status:      status,
			AssigneeID:  assigneeID,
			CreatedBy:   createdBy,
		}
		if err := tx.Create(&row).Error; err != nil {
			return 0, err
		}
		return row.ID, nil
	}

	if err := tx.Model(&seedTask{}).
		Where("id = ?", existing.ID).
		Updates(map[string]interface{}{
			"description": description,
			"status":      status,
			"assignee_id": assigneeID,
			"created_by":  createdBy,
		}).Error; err != nil {
		return 0, err
	}

	return existing.ID, nil
}

func ensureComment(
	tx *gorm.DB,
	taskID uint,
	authorID uint,
	content string,
) error {
	var existing seedComment

	err := tx.Where("task_id = ? AND author_id = ? AND content = ?", taskID, authorID, content).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if errors.Is(err, gorm.ErrRecordNotFound) {
		row := seedComment{
			TaskID:   taskID,
			AuthorID: authorID,
			Content:  content,
		}
		return tx.Create(&row).Error
	}

	return nil
}
