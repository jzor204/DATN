ALTER TABLE task_change_requests
    ADD COLUMN task_updated_at TIMESTAMPTZ NULL,
    ADD COLUMN review_note TEXT NULL;

CREATE TABLE activities (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL,
    task_id BIGINT NULL,
    actor_id BIGINT NULL,
    type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    payload_json JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_activities_project
        FOREIGN KEY (project_id) REFERENCES projects(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_activities_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT fk_activities_actor
        FOREIGN KEY (actor_id) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_activities_project_id_created_at ON activities(project_id, created_at);
CREATE INDEX idx_activities_task_id_created_at ON activities(task_id, created_at);
CREATE INDEX idx_activities_actor_id ON activities(actor_id);
CREATE INDEX idx_activities_type ON activities(type);
