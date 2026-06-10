ALTER TABLE tasks
    ADD COLUMN deadline DATETIME NULL AFTER assignee_id,
    ADD KEY idx_tasks_deadline (deadline);
