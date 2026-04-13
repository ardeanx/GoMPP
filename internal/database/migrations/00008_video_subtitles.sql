-- +goose Up

-- Subtitle tracks attached to videos (downloaded from OpenSubtitles or uploaded manually)
CREATE TABLE IF NOT EXISTS video_subtitles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,            -- e.g. "en", "id", "fr"
    label VARCHAR(255) NOT NULL DEFAULT '',   -- display label e.g. "English", "Indonesian"
    file_path VARCHAR(1024) NOT NULL,         -- storage path to the subtitle file
    format VARCHAR(10) NOT NULL DEFAULT 'srt', -- srt, vtt, ass, sub
    source VARCHAR(50) NOT NULL DEFAULT 'opensubtitles', -- opensubtitles, upload, manual
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_video_subtitles_video_id ON video_subtitles(video_id);

-- Add ctrl_opensubtitle system setting (controls OpenSubtitles integration in player/UI)
INSERT INTO system_settings (key, value) VALUES ('ctrl_opensubtitle', 'true')
    ON CONFLICT (key) DO NOTHING;

-- +goose Down

DROP TABLE IF EXISTS video_subtitles;
DELETE FROM system_settings WHERE key = 'ctrl_opensubtitle';
