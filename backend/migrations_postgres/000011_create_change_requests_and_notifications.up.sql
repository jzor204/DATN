CREATE TABLE task_change_requests (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    requested_by BIGINT NOT NULL,
    payload_json JSONB NOT NULL,
    reason TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reviewed_by BIGINT NULL,
    reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_change_requests_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_task_change_requests_project
        FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_task_change_requests_requested_by
        FOREIGN KEY (requested_by) REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    CONSTRAINT fk_task_change_requests_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_task_change_requests_task_id ON task_change_requests(task_id);
CREATE INDEX idx_task_change_requests_project_id ON task_change_requests(project_id);
CREATE INDEX idx_task_change_requests_requested_by ON task_change_requests(requested_by);
CREATE INDEX idx_task_change_requests_status ON task_change_requests(status);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    actor_id BIGINT NULL,
    type VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NULL,
    payload_json JSONB NULL,
    read_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_notifications_actor
        FOREIGN KEY (actor_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_notifications_user_id_created_at ON notifications(user_id, created_at);
CREATE INDEX idx_notifications_user_id_read_at ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_type ON notifications(type);
