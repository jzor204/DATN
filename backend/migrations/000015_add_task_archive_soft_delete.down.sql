ALTER TABLE tasks
    DROP FOREIGN KEY fk_tasks_deleted_by,
    DROP FOREIGN KEY fk_tasks_archived_by,
    DROP INDEX idx_tasks_deleted_by,
    DROP INDEX idx_tasks_archived_by,
    DROP INDEX idx_tasks_deleted_at,
    DROP INDEX idx_tasks_archived_at,
    DROP COLUMN deleted_by,
    DROP COLUMN deleted_at,
    DROP COLUMN archived_by,
    DROP COLUMN archived_at;
