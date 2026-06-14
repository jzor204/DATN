CREATE TABLE checklists (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    position INT NOT NULL DEFAULT 1,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_checklists_task
        FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_checklists_created_by
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

CREATE INDEX idx_checklists_task_id ON checklists(task_id);
CREATE INDEX idx_checklists_created_by ON checklists(created_by);

ALTER TABLE checklist_items
    ADD COLUMN checklist_id BIGINT NULL;

CREATE INDEX idx_checklist_items_checklist_id ON checklist_items(checklist_id);

INSERT INTO checklists (task_id, title, position, created_by, created_at, updated_at)
SELECT task_id, 'Viec can lam', 1, MIN(created_by), MIN(created_at), MAX(updated_at)
FROM checklist_items
WHERE checklist_id IS NULL
GROUP BY task_id;

UPDATE checklist_items AS ci
SET checklist_id = c.id
FROM checklists AS c
WHERE c.task_id = ci.task_id
    AND c.position = 1
    AND ci.checklist_id IS NULL;

ALTER TABLE checklist_items
    ALTER COLUMN checklist_id SET NOT NULL;

ALTER TABLE checklist_items
    ADD CONSTRAINT fk_checklist_items_checklist
        FOREIGN KEY (checklist_id) REFERENCES checklists(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
