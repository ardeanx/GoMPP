-- +goose Up
-- Support multiple resolutions per preset.
-- We replace the scalar resolution/width/height columns with a JSONB array.

ALTER TABLE encoding_presets
    ADD COLUMN IF NOT EXISTS resolutions JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Migrate existing data: convert scalar resolution → resolutions array
UPDATE encoding_presets
SET resolutions = jsonb_build_array(
    jsonb_build_object('label', resolution, 'width', width, 'height', height)
)
WHERE resolutions = '[]'::jsonb;

-- Keep old columns for backward compatibility (read-only, will be ignored).
-- They will not be dropped to avoid breaking running queries during rolling deploys.

-- +goose Down
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS resolutions;
