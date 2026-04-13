-- +goose Up
ALTER TABLE videos ADD COLUMN allow_download BOOLEAN NOT NULL DEFAULT false;

-- +goose Down
ALTER TABLE videos DROP COLUMN IF EXISTS allow_download;
