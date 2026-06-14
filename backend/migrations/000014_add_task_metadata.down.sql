DROP TABLE IF EXISTS task_attachments;
DROP TABLE IF EXISTS task_labels;

ALTER TABLE tasks
    DROP INDEX idx_tasks_priority,
    DROP INDEX idx_tasks_reminder_at,
    DROP COLUMN priority,
    DROP COLUMN reminder_at;
