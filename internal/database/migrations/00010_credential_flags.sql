-- +goose Up
ALTER TABLE user_credentials ADD COLUMN IF NOT EXISTS backup_eligible BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_credentials ADD COLUMN IF NOT EXISTS backup_state    BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE user_credentials DROP COLUMN IF EXISTS backup_state;
ALTER TABLE user_credentials DROP COLUMN IF EXISTS backup_eligible;
