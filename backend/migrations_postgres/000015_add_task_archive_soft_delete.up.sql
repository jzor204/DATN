ALTER TABLE tasks
    ADD COLUMN archived_at TIMESTAMPTZ NULL,
    ADD COLUMN archived_by BIGINT NULL,
    ADD COLUMN deleted_at TIMESTAMPTZ NULL,
    ADD COLUMN deleted_by BIGINT NULL;

CREATE INDEX idx_tasks_archived_at ON tasks(archived_at);
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at);
CREATE INDEX idx_tasks_archived_by ON tasks(archived_by);
CREATE INDEX idx_tasks_deleted_by ON tasks(deleted_by);

ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_archived_by
        FOREIGN KEY (archived_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    ADD CONSTRAINT fk_tasks_deleted_by
        FOREIGN KEY (deleted_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
