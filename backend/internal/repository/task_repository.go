package repository

import (
	"context"
	"errors"
	"time"

	"task-management/internal/domain"

	"gorm.io/gorm"
)

type TaskRepository struct {
	db *gorm.DB
}

type taskModel struct {
	ID          uint       `gorm:"column:id;primaryKey;autoIncrement"`
	ProjectID   uint       `gorm:"column:project_id;not null"`
	Title       string     `gorm:"column:title;size:255;not null"`
	Description string     `gorm:"column:description;type:text"`
	Status      string     `gorm:"column:status;size:50;not null"`
	Progress    int        `gorm:"column:progress;not null"`
	AssigneeID  *uint      `gorm:"column:assignee_id"`
	Deadline    *time.Time `gorm:"column:deadline"`
	CreatedBy   uint       `gorm:"column:created_by;not null"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
}

type taskAssigneeModel struct {
	TaskID    uint      `gorm:"column:task_id;primaryKey"`
	UserID    uint      `gorm:"column:user_id;primaryKey"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (taskModel) TableName() string {
	return "tasks"
}

func (taskAssigneeModel) TableName() string {
	return "task_assignees"
}

func NewTaskRepository(db *gorm.DB) *TaskRepository {
	return &TaskRepository{
		db: db,
	}
}

func (r *TaskRepository) Create(ctx context.Context, task *domain.Task) error {
	row := &taskModel{
		ProjectID:   task.ProjectID,
		Title:       task.Title,
		Description: task.Description,
		Status:      task.Status,
		Progress:    task.Progress,
		AssigneeID:  task.AssigneeID,
		Deadline:    task.Deadline,
		CreatedBy:   task.CreatedBy,
	}

	if err := r.db.WithContext(ctx).Create(row).Error; err != nil {
		return err
	}

	task.ID = row.ID
	task.CreatedAt = row.CreatedAt
	task.UpdatedAt = row.UpdatedAt
	task.AssigneeIDs = normalizeAssigneeIDsForStorage(task.AssigneeIDs, task.AssigneeID)

	if err := r.replaceAssignees(ctx, task.ID, task.AssigneeIDs); err != nil {
		return err
	}

	return nil
}

func (r *TaskRepository) GetByID(ctx context.Context, id uint) (*domain.Task, error) {
	var row taskModel

	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	task := mapTaskModelToDomain(row)
	if err := r.hydrateAssignees(ctx, []*domain.Task{task}); err != nil {
		return nil, err
	}

	return task, nil
}

func (r *TaskRepository) Update(ctx context.Context, task *domain.Task) error {
	result := r.db.WithContext(ctx).
		Model(&taskModel{}).
		Where("id = ?", task.ID).
		Updates(map[string]interface{}{
			"title":       task.Title,
			"description": task.Description,
			"status":      task.Status,
			"progress":    task.Progress,
			"assignee_id": task.AssigneeID,
			"deadline":    task.Deadline,
		})
	if result.Error != nil {
		return result.Error
	}

	if task.AssigneeIDs != nil {
		if err := r.replaceAssignees(ctx, task.ID, task.AssigneeIDs); err != nil {
			return err
		}
	}

	refreshed, err := r.GetByID(ctx, task.ID)
	if err != nil {
		return err
	}
	if refreshed != nil {
		task.CreatedAt = refreshed.CreatedAt
		task.UpdatedAt = refreshed.UpdatedAt
	}

	return nil
}

func (r *TaskRepository) UpdateProgress(ctx context.Context, taskID uint, progress int) error {
	return r.db.WithContext(ctx).
		Model(&taskModel{}).
		Where("id = ?", taskID).
		Update("progress", progress).Error
}

func (r *TaskRepository) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).
		Delete(&taskModel{}, id).Error
}

func (r *TaskRepository) ListByProject(ctx context.Context, projectID uint, page int, pageSize int) ([]*domain.Task, int64, error) {
	var (
		rows  []taskModel
		total int64
	)

	if err := r.db.WithContext(ctx).
		Model(&taskModel{}).
		Where("project_id = ?", projectID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.Task, 0, len(rows))
	for i := range rows {
		result = append(result, mapTaskModelToDomain(rows[i]))
	}

	if err := r.hydrateAssignees(ctx, result); err != nil {
		return nil, 0, err
	}

	return result, total, nil
}

func (r *TaskRepository) ListAssignedToUser(
	ctx context.Context,
	userID uint,
	projectID *uint,
	status string,
	requireMembership bool,
	page int,
	pageSize int,
) ([]*domain.Task, int64, error) {
	var (
		rows  []taskModel
		total int64
	)

	buildQuery := func() *gorm.DB {
		query := r.db.WithContext(ctx).
			Model(&taskModel{}).
			Where(
				"tasks.assignee_id = ? OR EXISTS (SELECT 1 FROM task_assignees WHERE task_assignees.task_id = tasks.id AND task_assignees.user_id = ?)",
				userID,
				userID,
			)

		if requireMembership {
			query = query.Joins(
				"JOIN project_members ON project_members.project_id = tasks.project_id AND project_members.user_id = ?",
				userID,
			)
		}

		if projectID != nil {
			query = query.Where("tasks.project_id = ?", *projectID)
		}

		if status != "" {
			query = query.Where("tasks.status = ?", status)
		}

		return query
	}

	if err := buildQuery().Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := buildQuery().
		Order("tasks.updated_at DESC, tasks.id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]*domain.Task, 0, len(rows))
	for i := range rows {
		result = append(result, mapTaskModelToDomain(rows[i]))
	}

	if err := r.hydrateAssignees(ctx, result); err != nil {
		return nil, 0, err
	}

	return result, total, nil
}

func (r *TaskRepository) replaceAssignees(ctx context.Context, taskID uint, assigneeIDs []uint) error {
	tx := r.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := tx.Where("task_id = ?", taskID).Delete(&taskAssigneeModel{}).Error; err != nil {
		tx.Rollback()
		return err
	}

	rows := make([]taskAssigneeModel, 0, len(assigneeIDs))
	for _, userID := range assigneeIDs {
		rows = append(rows, taskAssigneeModel{
			TaskID: taskID,
			UserID: userID,
		})
	}

	if len(rows) > 0 {
		if err := tx.Create(&rows).Error; err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit().Error
}

func (r *TaskRepository) hydrateAssignees(ctx context.Context, tasks []*domain.Task) error {
	if len(tasks) == 0 {
		return nil
	}

	taskIDs := make([]uint, 0, len(tasks))
	taskByID := make(map[uint]*domain.Task, len(tasks))
	for _, task := range tasks {
		taskIDs = append(taskIDs, task.ID)
		taskByID[task.ID] = task
		task.AssigneeIDs = []uint{}
	}

	var rows []taskAssigneeModel
	if err := r.db.WithContext(ctx).
		Where("task_id IN ?", taskIDs).
		Order("created_at ASC, user_id ASC").
		Find(&rows).Error; err != nil {
		return err
	}

	for _, row := range rows {
		if task := taskByID[row.TaskID]; task != nil {
			task.AssigneeIDs = append(task.AssigneeIDs, row.UserID)
		}
	}

	for _, task := range tasks {
		if len(task.AssigneeIDs) == 0 && task.AssigneeID != nil {
			task.AssigneeIDs = []uint{*task.AssigneeID}
		}
	}

	return nil
}

func normalizeAssigneeIDsForStorage(assigneeIDs []uint, fallback *uint) []uint {
	seen := make(map[uint]struct{}, len(assigneeIDs)+1)
	result := make([]uint, 0, len(assigneeIDs)+1)

	for _, userID := range assigneeIDs {
		if userID == 0 {
			continue
		}
		if _, ok := seen[userID]; ok {
			continue
		}
		seen[userID] = struct{}{}
		result = append(result, userID)
	}

	if len(result) == 0 && fallback != nil && *fallback != 0 {
		result = append(result, *fallback)
	}

	return result
}

func mapTaskModelToDomain(row taskModel) *domain.Task {
	return &domain.Task{
		ID:          row.ID,
		ProjectID:   row.ProjectID,
		Title:       row.Title,
		Description: row.Description,
		Status:      row.Status,
		Progress:    row.Progress,
		AssigneeID:  row.AssigneeID,
		AssigneeIDs: nil,
		Deadline:    row.Deadline,
		CreatedBy:   row.CreatedBy,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}
