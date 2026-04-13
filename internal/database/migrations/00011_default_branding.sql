-- +migrate Up
-- Seed default branding settings (logo and favicon) for fresh installs.

INSERT INTO system_settings (key, value, description) VALUES
    ('site_logo', '"/gompp.webp"', 'Default system logo'),
    ('site_favicon', '"/gompp.webp"', 'Default system favicon'),
    ('site_name', '"GoMPP"', 'Default site name')
ON CONFLICT (key) DO NOTHING;

-- +migrate Down

DELETE FROM system_settings WHERE key IN ('site_logo', 'site_favicon', 'site_name')
    AND value IN ('"/gompp.webp"', '"GoMPP"');
