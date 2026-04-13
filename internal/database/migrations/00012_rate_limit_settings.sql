-- +migrate Up
-- Seed default rate-limit settings (editable via Security Settings).

INSERT INTO system_settings (key, value, description) VALUES
    ('rate_limit_rpm', '60', 'General rate limit (requests per minute)'),
    ('auth_rate_limit_rpm', '10', 'Auth rate limit (requests per minute)')
ON CONFLICT (key) DO NOTHING;

-- +migrate Down

DELETE FROM system_settings WHERE key IN ('rate_limit_rpm', 'auth_rate_limit_rpm');
