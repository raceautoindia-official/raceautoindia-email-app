-- 010_subscriber_extras.sql
-- Adds tags, notes, custom_fields, engagement_score, last_sent_at to emails.
-- New tables: subscriber_tags, app_users, api_keys, webhooks, notifications.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_010 $$
CREATE PROCEDURE migrate_010()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'tags') THEN
    ALTER TABLE emails ADD COLUMN tags JSON NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'notes') THEN
    ALTER TABLE emails ADD COLUMN notes TEXT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'custom_fields') THEN
    ALTER TABLE emails ADD COLUMN custom_fields JSON NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'engagement_score') THEN
    ALTER TABLE emails ADD COLUMN engagement_score INT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'last_sent_at') THEN
    ALTER TABLE emails ADD COLUMN last_sent_at DATETIME NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND INDEX_NAME = 'idx_engagement') THEN
    ALTER TABLE emails ADD KEY idx_engagement (engagement_score);
  END IF;

  -- campaigns: status & analytics counters
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'status') THEN
    ALTER TABLE campaigns ADD COLUMN status ENUM('draft','active','archived') NOT NULL DEFAULT 'active';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'preview_text') THEN
    ALTER TABLE campaigns ADD COLUMN preview_text VARCHAR(255) NULL;
  END IF;

  -- email_jobs: human-friendly name
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_jobs' AND COLUMN_NAME = 'name') THEN
    ALTER TABLE email_jobs ADD COLUMN name VARCHAR(255) NULL;
  END IF;
END $$

CALL migrate_010() $$
DROP PROCEDURE migrate_010 $$
DELIMITER ;

-- Subscriber tags (flat label cloud, distinct from categories)
CREATE TABLE IF NOT EXISTS subscriber_tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  color VARCHAR(9) NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tag_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_tag_links (
  email_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email_id, tag_id),
  KEY idx_tag (tag_id),
  CONSTRAINT fk_etl_email FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
  CONSTRAINT fk_etl_tag FOREIGN KEY (tag_id) REFERENCES subscriber_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- App users (admin accounts)
CREATE TABLE IF NOT EXISTS app_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(120) NULL,
  role ENUM('admin','editor','viewer') NOT NULL DEFAULT 'admin',
  password_hash VARCHAR(255) NULL,
  last_seen_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- API keys
CREATE TABLE IF NOT EXISTS api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  key_prefix VARCHAR(12) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  last_used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  KEY idx_prefix (key_prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(500) NOT NULL,
  events JSON NOT NULL,
  secret VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_fired_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NULL,
  link VARCHAR(500) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_unread (is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
