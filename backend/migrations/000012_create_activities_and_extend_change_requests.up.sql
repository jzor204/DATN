ALTER TABLE task_change_requests
    ADD COLUMN task_updated_at DATETIME NULL AFTER reason,
    ADD COLUMN review_note TEXT NULL AFTER reviewed_at;

CREATE TABLE activities (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    project_id BIGINT UNSIGNED NOT NULL,
    task_id BIGINT UNSIGNED NULL,
    actor_id BIGINT UNSIGNED NULL,
    type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    payload_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_activities_project_id_created_at (project_id, created_at),
    KEY idx_activities_task_id_created_at (task_id, created_at),
    KEY idx_activities_actor_id (actor_id),
    KEY idx_activities_type (type),
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
