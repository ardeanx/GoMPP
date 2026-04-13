-- +goose Up

-- Track when the user last changed their password
ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMPTZ;

-- ============================================================
-- Account Sessions (device / login log)
-- ============================================================

CREATE TABLE account_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name     VARCHAR(150) NOT NULL DEFAULT '',
    device_os       VARCHAR(100) NOT NULL DEFAULT '',
    browser         VARCHAR(200) NOT NULL DEFAULT '',
    ip_address      INET,
    location        VARCHAR(150) NOT NULL DEFAULT '',
    last_session_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_sessions_user_id ON account_sessions (user_id);
CREATE INDEX idx_account_sessions_last_session ON account_sessions (last_session_at DESC);

CREATE TRIGGER trg_account_sessions_updated_at
    BEFORE UPDATE ON account_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- +goose Down

DROP TABLE IF EXISTS account_sessions;
ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at;
