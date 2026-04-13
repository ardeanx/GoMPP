-- +goose Up
-- Add hardware acceleration column to encoding presets.

ALTER TABLE encoding_presets
    ADD COLUMN IF NOT EXISTS hw_accel VARCHAR(20) NOT NULL DEFAULT 'none';

-- +goose Down
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS hw_accel;
