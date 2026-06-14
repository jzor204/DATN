ALTER TABLE tasks
    ADD COLUMN deadline TIMESTAMPTZ NULL;

CREATE INDEX idx_tasks_deadline ON tasks(deadline);
