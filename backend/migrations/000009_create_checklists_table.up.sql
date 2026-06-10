CREATE TABLE checklists (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    task_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    position INT NOT NULL DEFAULT 1,
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_checklists_task_id (task_id),
    KEY idx_checklists_created_by (created_by),
    CONSTRAINT fk_checklists_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_checklists_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE checklist_items
    ADD COLUMN checklist_id BIGINT UNSIGNED NULL AFTER task_id,
    ADD KEY idx_checklist_items_checklist_id (checklist_id);

INSERT INTO checklists (task_id, title, position, created_by, created_at, updated_at)
SELECT task_id, 'Việc cần làm', 1, MIN(created_by), MIN(created_at), MAX(updated_at)
FROM checklist_items
WHERE checklist_id IS NULL
GROUP BY task_id;

UPDATE checklist_items AS ci
JOIN checklists AS c
    ON c.task_id = ci.task_id
    AND c.position = 1
SET ci.checklist_id = c.id
WHERE ci.checklist_id IS NULL;

ALTER TABLE checklist_items
    MODIFY checklist_id BIGINT UNSIGNED NOT NULL,
    ADD CONSTRAINT fk_checklist_items_checklist
        FOREIGN KEY (checklist_id) REFERENCES checklists(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
