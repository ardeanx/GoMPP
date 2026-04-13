-- +goose Up

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Users & Authentication
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'user'
                    CHECK (role IN ('admin', 'user')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_role ON users (role);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- API Keys
-- ============================================================

CREATE TABLE api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(100) NOT NULL,
    key_hash     TEXT NOT NULL UNIQUE,
    key_prefix   VARCHAR(8) NOT NULL,
    scopes       TEXT[] NOT NULL DEFAULT '{}',
    expires_at   TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);

CREATE TRIGGER trg_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Encoding Presets
-- ============================================================

CREATE TABLE encoding_presets (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           VARCHAR(100) NOT NULL,
    codec          VARCHAR(20) NOT NULL,
    container      VARCHAR(20) NOT NULL DEFAULT 'mp4',
    resolution     VARCHAR(20) NOT NULL,
    width          INTEGER NOT NULL,
    height         INTEGER NOT NULL,
    video_bitrate  VARCHAR(20) NOT NULL,
    audio_codec    VARCHAR(20) NOT NULL DEFAULT 'aac',
    audio_bitrate  VARCHAR(20) NOT NULL DEFAULT '128k',
    audio_channels INTEGER NOT NULL DEFAULT 2,
    framerate      INTEGER,
    pixel_format   VARCHAR(20) NOT NULL DEFAULT 'yuv420p',
    preset_speed   VARCHAR(20) NOT NULL DEFAULT 'medium',
    crf            INTEGER NOT NULL DEFAULT 23,
    extra_flags    TEXT,
    is_default     BOOLEAN NOT NULL DEFAULT false,
    is_active      BOOLEAN NOT NULL DEFAULT true,
    sort_order     INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_encoding_presets_updated_at
    BEFORE UPDATE ON encoding_presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Videos
-- ============================================================

CREATE TABLE videos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id),
    title             VARCHAR(255) NOT NULL,
    description       TEXT,
    slug              VARCHAR(255) NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type         VARCHAR(50) NOT NULL,
    file_size         BIGINT NOT NULL,
    duration          FLOAT,
    width             INTEGER,
    height            INTEGER,
    status            VARCHAR(20) NOT NULL DEFAULT 'uploading'
                      CHECK (status IN ('uploading','uploaded','processing',
                             'ready','failed','deleted')),
    source_path       TEXT NOT NULL,
    thumbnail_path    TEXT,
    preview_path      TEXT,
    master_playlist   TEXT,
    error_message     TEXT,
    view_count        BIGINT NOT NULL DEFAULT 0,
    is_public         BOOLEAN NOT NULL DEFAULT false,
    metadata          JSONB DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX idx_videos_user_id ON videos (user_id);
CREATE INDEX idx_videos_status ON videos (status);
CREATE INDEX idx_videos_slug ON videos (slug);
CREATE INDEX idx_videos_created_at ON videos (created_at DESC);
CREATE INDEX idx_videos_deleted_at ON videos (deleted_at) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Transcode Jobs
-- ============================================================

CREATE TABLE transcode_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id      UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    preset_id     UUID NOT NULL REFERENCES encoding_presets(id),
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','completed',
                         'failed','cancelled')),
    progress      FLOAT NOT NULL DEFAULT 0
                  CHECK (progress BETWEEN 0 AND 100),
    output_path   TEXT,
    output_size   BIGINT,
    duration      FLOAT,
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    error_message TEXT,
    attempts      INTEGER NOT NULL DEFAULT 0,
    max_attempts  INTEGER NOT NULL DEFAULT 3,
    worker_id     VARCHAR(100),
    ffmpeg_log    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcode_jobs_video_id ON transcode_jobs (video_id);
CREATE INDEX idx_transcode_jobs_status ON transcode_jobs (status);
CREATE INDEX idx_transcode_jobs_pending ON transcode_jobs (created_at)
    WHERE status = 'pending';

CREATE TRIGGER trg_transcode_jobs_updated_at
    BEFORE UPDATE ON transcode_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Webhooks
-- ============================================================

CREATE TABLE webhooks (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    url        TEXT NOT NULL,
    secret     TEXT NOT NULL,
    events     TEXT[] NOT NULL DEFAULT '{}',
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_user_id ON webhooks (user_id);
CREATE INDEX idx_webhooks_events ON webhooks USING gin (events);

CREATE TRIGGER trg_webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Webhook Deliveries
-- ============================================================

CREATE TABLE webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id      UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type      VARCHAR(50) NOT NULL,
    payload         JSONB NOT NULL,
    response_status INTEGER,
    response_body   TEXT,
    duration_ms     INTEGER,
    attempt         INTEGER NOT NULL DEFAULT 1,
    delivered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries (webhook_id);
CREATE INDEX idx_webhook_deliveries_delivered_at ON webhook_deliveries (delivered_at DESC);

-- ============================================================
-- Video Analytics
-- ============================================================

CREATE TABLE video_analytics (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id          UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    event_type        VARCHAR(20) NOT NULL
                      CHECK (event_type IN ('view', 'play', 'complete', 'embed_view')),
    ip_address        INET,
    user_agent        TEXT,
    referer           TEXT,
    country           VARCHAR(2),
    duration_watched  FLOAT,
    bytes_transferred BIGINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_video_analytics_video_id ON video_analytics (video_id);
CREATE INDEX idx_video_analytics_created_at ON video_analytics (created_at DESC);
CREATE INDEX idx_video_analytics_event_type ON video_analytics (event_type);

-- ============================================================
-- Settings Tables (key-value stores)
-- ============================================================

CREATE TABLE system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    description TEXT,
    updated_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_system_settings_updated_at
    BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE player_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    description TEXT,
    updated_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_player_settings_updated_at
    BEFORE UPDATE ON player_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE storage_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    description TEXT,
    updated_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_storage_settings_updated_at
    BEFORE UPDATE ON storage_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE transcode_encoding_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    description TEXT,
    updated_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_transcode_encoding_settings_updated_at
    BEFORE UPDATE ON transcode_encoding_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE security_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    description TEXT,
    updated_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_security_settings_updated_at
    BEFORE UPDATE ON security_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- +goose Down

DROP TABLE IF EXISTS security_settings;
DROP TABLE IF EXISTS transcode_encoding_settings;
DROP TABLE IF EXISTS storage_settings;
DROP TABLE IF EXISTS player_settings;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS video_analytics;
DROP TABLE IF EXISTS webhook_deliveries;
DROP TABLE IF EXISTS webhooks;
DROP TABLE IF EXISTS transcode_jobs;
DROP TABLE IF EXISTS videos;
DROP TABLE IF EXISTS encoding_presets;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS users;
DROP FUNCTION IF EXISTS update_updated_at();
