ALTER TABLE tasks
    ADD COLUMN priority VARCHAR(20) NOT NULL DEFAULT 'none',
    ADD COLUMN reminder_at TIMESTAMPTZ NULL;

CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_reminder_at ON tasks(reminder_at);

CREATE TABLE task_labels (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    color VARCHAR(30) NOT NULL DEFAULT 'blue',
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_labels_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_task_labels_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX idx_task_labels_task_id ON task_labels(task_id);
CREATE INDEX idx_task_labels_created_by ON task_labels(created_by);

CREATE TABLE task_attachments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_attachments_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_task_attachments_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX idx_task_attachments_created_by ON task_attachments(created_by);
