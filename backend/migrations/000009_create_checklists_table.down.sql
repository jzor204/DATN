ALTER TABLE checklist_items
    DROP FOREIGN KEY fk_checklist_items_checklist;

ALTER TABLE checklist_items
    DROP INDEX idx_checklist_items_checklist_id;

ALTER TABLE checklist_items
    DROP COLUMN checklist_id;

DROP TABLE IF EXISTS checklists;
