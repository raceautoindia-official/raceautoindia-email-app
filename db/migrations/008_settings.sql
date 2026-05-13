-- 008_settings.sql
-- Single-row key/value app settings

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- seed defaults
INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('default_rate_limit', '10'),
  ('default_monitor_email', ''),
  ('default_monitor_every', '1000'),
  ('sender_name', 'Race Auto India');
