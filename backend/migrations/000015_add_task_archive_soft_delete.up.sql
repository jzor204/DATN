ALTER TABLE tasks
    ADD COLUMN archived_at DATETIME NULL AFTER reminder_at,
    ADD COLUMN archived_by BIGINT UNSIGNED NULL AFTER archived_at,
    ADD COLUMN deleted_at DATETIME NULL AFTER archived_by,
    ADD COLUMN deleted_by BIGINT UNSIGNED NULL AFTER deleted_at,
    ADD KEY idx_tasks_archived_at (archived_at),
    ADD KEY idx_tasks_deleted_at (deleted_at),
    ADD KEY idx_tasks_archived_by (archived_by),
    ADD KEY idx_tasks_deleted_by (deleted_by),
    ADD CONSTRAINT fk_tasks_archived_by
        FOREIGN KEY (archived_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    ADD CONSTRAINT fk_tasks_deleted_by
        FOREIGN KEY (deleted_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
