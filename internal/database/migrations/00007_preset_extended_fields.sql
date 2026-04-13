-- +goose Up

-- Add extended encoding fields to presets
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS output_format VARCHAR(20) NOT NULL DEFAULT 'hls';
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS hls_segment_duration INTEGER NOT NULL DEFAULT 6;
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS encryption VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS key_rotation_interval INTEGER NOT NULL DEFAULT 0;
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS signed_url_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS signed_url_expiry INTEGER NOT NULL DEFAULT 3600;
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS thumbnail_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS thumbnail_interval INTEGER NOT NULL DEFAULT 10;
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS banner_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS banner_timestamp INTEGER NOT NULL DEFAULT 5;
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS faststart BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS movflags VARCHAR(100) NOT NULL DEFAULT '+faststart';
ALTER TABLE encoding_presets ADD COLUMN IF NOT EXISTS two_pass BOOLEAN NOT NULL DEFAULT false;

-- Add device_type to video_analytics for device tracking
ALTER TABLE video_analytics ADD COLUMN IF NOT EXISTS device_type VARCHAR(30);
ALTER TABLE video_analytics ADD COLUMN IF NOT EXISTS os_name VARCHAR(50);
ALTER TABLE video_analytics ADD COLUMN IF NOT EXISTS browser_name VARCHAR(50);

-- Add index for device analytics
CREATE INDEX IF NOT EXISTS idx_video_analytics_device_type ON video_analytics (device_type);

-- Add opensubtitles API key to system settings default
INSERT INTO system_settings (key, value) VALUES ('opensubtitles_api_key', '""')
    ON CONFLICT (key) DO NOTHING;

-- +goose Down

ALTER TABLE encoding_presets DROP COLUMN IF EXISTS output_format;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS hls_segment_duration;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS encryption;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS key_rotation_interval;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS signed_url_enabled;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS signed_url_expiry;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS thumbnail_enabled;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS thumbnail_interval;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS banner_enabled;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS banner_timestamp;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS faststart;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS movflags;
ALTER TABLE encoding_presets DROP COLUMN IF EXISTS two_pass;

ALTER TABLE video_analytics DROP COLUMN IF EXISTS device_type;
ALTER TABLE video_analytics DROP COLUMN IF EXISTS os_name;
ALTER TABLE video_analytics DROP COLUMN IF EXISTS browser_name;

DROP INDEX IF EXISTS idx_video_analytics_device_type;
