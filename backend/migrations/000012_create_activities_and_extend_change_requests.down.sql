DROP TABLE IF EXISTS activities;

ALTER TABLE task_change_requests
    DROP COLUMN review_note,
    DROP COLUMN task_updated_at;
