package domain

import "time"

const (
	ActivityTypeTaskCreated           = "task.created"
	ActivityTypeTaskUpdated           = "task.updated"
	ActivityTypeTaskDeleted           = "task.deleted"
	ActivityTypeTaskArchived          = "task.archived"
	ActivityTypeTaskRestored          = "task.restored"
	ActivityTypeCommentCreated        = "comment.created"
	ActivityTypeCommentUpdated        = "comment.updated"
	ActivityTypeCommentDeleted        = "comment.deleted"
	ActivityTypeChecklistCreated      = "checklist.created"
	ActivityTypeChecklistDeleted      = "checklist.deleted"
	ActivityTypeChecklistItemCreated  = "checklist_item.created"
	ActivityTypeChecklistItemUpdated  = "checklist_item.updated"
	ActivityTypeChecklistItemDeleted  = "checklist_item.deleted"
	ActivityTypeTaskLabelCreated      = "task_label.created"
	ActivityTypeTaskLabelUpdated      = "task_label.updated"
	ActivityTypeTaskLabelDeleted      = "task_label.deleted"
	ActivityTypeTaskAttachmentCreated = "task_attachment.created"
	ActivityTypeTaskAttachmentUpdated = "task_attachment.updated"
	ActivityTypeTaskAttachmentDeleted = "task_attachment.deleted"
	ActivityTypeChangeRequestCreated  = "change_request.created"
	ActivityTypeChangeRequestApproved = "change_request.approved"
	ActivityTypeChangeRequestRejected = "change_request.rejected"
	ActivityTypeChangeRequestCanceled = "change_request.canceled"
)

type Activity struct {
	ID          uint
	ProjectID   uint
	TaskID      *uint
	ActorID     *uint
	Type        string
	Message     string
	PayloadJSON string
	CreatedAt   time.Time
}
