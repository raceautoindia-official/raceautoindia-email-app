-- ============================================================================
-- MailDeck — complete consolidated schema migration
-- ============================================================================
-- Apply with:
--   mysql -u root -p bulk_email < db/migrations/ALL_MIGRATIONS.sql
--
-- Every statement is idempotent: safe to re-run on an existing database.
-- Order matters — do not reorganize sections.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. ALTER existing `emails` table (originally just id/email/subscribe/category_id)
-- ----------------------------------------------------------------------------

DELIMITER $$
DROP PROCEDURE IF EXISTS maildeck_alter_emails $$
CREATE PROCEDURE maildeck_alter_emails()
BEGIN
  -- UNIQUE on email
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND INDEX_NAME='uq_emails_email') THEN
    ALTER TABLE emails ADD UNIQUE KEY uq_emails_email (email);
  END IF;

  -- audit & soft-delete columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='created_at') THEN
    ALTER TABLE emails ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='updated_at') THEN
    ALTER TABLE emails ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='deleted_at') THEN
    ALTER TABLE emails ADD COLUMN deleted_at DATETIME NULL;
  END IF;

  -- last-event tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='last_event_at') THEN
    ALTER TABLE emails ADD COLUMN last_event_at DATETIME NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='last_event_status') THEN
    ALTER TABLE emails ADD COLUMN last_event_status VARCHAR(20) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='last_sent_at') THEN
    ALTER TABLE emails ADD COLUMN last_sent_at DATETIME NULL;
  END IF;

  -- profile fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='first_name') THEN
    ALTER TABLE emails ADD COLUMN first_name VARCHAR(100) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='last_name') THEN
    ALTER TABLE emails ADD COLUMN last_name VARCHAR(100) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='tags') THEN
    ALTER TABLE emails ADD COLUMN tags JSON NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='notes') THEN
    ALTER TABLE emails ADD COLUMN notes TEXT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='custom_fields') THEN
    ALTER TABLE emails ADD COLUMN custom_fields JSON NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND COLUMN_NAME='engagement_score') THEN
    ALTER TABLE emails ADD COLUMN engagement_score INT NOT NULL DEFAULT 0;
  END IF;

  -- indexes
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND INDEX_NAME='idx_category_subscribe') THEN
    ALTER TABLE emails ADD KEY idx_category_subscribe (category_id, subscribe);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND INDEX_NAME='idx_subscribe') THEN
    ALTER TABLE emails ADD KEY idx_subscribe (subscribe);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND INDEX_NAME='idx_last_event_at') THEN
    ALTER TABLE emails ADD KEY idx_last_event_at (last_event_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND INDEX_NAME='idx_created_at') THEN
    ALTER TABLE emails ADD KEY idx_created_at (created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='emails' AND INDEX_NAME='idx_engagement') THEN
    ALTER TABLE emails ADD KEY idx_engagement (engagement_score);
  END IF;
END $$
CALL maildeck_alter_emails() $$
DROP PROCEDURE maildeck_alter_emails $$
DELIMITER ;


-- ----------------------------------------------------------------------------
-- 2. ALTER existing `email_events` table
-- ----------------------------------------------------------------------------

DELIMITER $$
DROP PROCEDURE IF EXISTS maildeck_alter_events $$
CREATE PROCEDURE maildeck_alter_events()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='email_events' AND COLUMN_NAME='job_id') THEN
    ALTER TABLE email_events ADD COLUMN job_id BIGINT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='email_events' AND COLUMN_NAME='campaign_id') THEN
    ALTER TABLE email_events ADD COLUMN campaign_id BIGINT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='email_events' AND INDEX_NAME='idx_event_time') THEN
    ALTER TABLE email_events ADD KEY idx_event_time (eventTime);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='email_events' AND INDEX_NAME='idx_status_time') THEN
    ALTER TABLE email_events ADD KEY idx_status_time (status, eventTime);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='email_events' AND INDEX_NAME='idx_email_time') THEN
    ALTER TABLE email_events ADD KEY idx_email_time (email, eventTime);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='email_events' AND INDEX_NAME='idx_job') THEN
    ALTER TABLE email_events ADD KEY idx_job (job_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='email_events' AND INDEX_NAME='idx_campaign') THEN
    ALTER TABLE email_events ADD KEY idx_campaign (campaign_id);
  END IF;
END $$
CALL maildeck_alter_events() $$
DROP PROCEDURE maildeck_alter_events $$
DELIMITER ;


-- ----------------------------------------------------------------------------
-- 3. ALTER existing `categories` table (color/position/soft-delete/uniques)
-- ----------------------------------------------------------------------------

DELIMITER $$
DROP PROCEDURE IF EXISTS maildeck_alter_categories $$
CREATE PROCEDURE maildeck_alter_categories()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND COLUMN_NAME='color') THEN
    ALTER TABLE categories ADD COLUMN color VARCHAR(9) NOT NULL DEFAULT '#6c757d';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND COLUMN_NAME='position') THEN
    ALTER TABLE categories ADD COLUMN position INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND COLUMN_NAME='deleted_at') THEN
    ALTER TABLE categories ADD COLUMN deleted_at DATETIME NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND COLUMN_NAME='created_at') THEN
    ALTER TABLE categories ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND COLUMN_NAME='updated_at') THEN
    ALTER TABLE categories ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND INDEX_NAME='uq_categories_slug') THEN
    ALTER TABLE categories ADD UNIQUE KEY uq_categories_slug (slug);
  END IF;

  -- backfill position for rows still at 0
  UPDATE categories SET position = id WHERE position = 0;
END $$
CALL maildeck_alter_categories() $$
DROP PROCEDURE maildeck_alter_categories $$
DELIMITER ;


-- ============================================================================
-- 4. CREATE new tables
-- ============================================================================

-- Suppression list (hard bounces, complaints, manual unsubscribes)
CREATE TABLE IF NOT EXISTS email_suppressions (
  email      VARCHAR(255) NOT NULL,
  reason     ENUM('bounce','complaint','unsubscribe','manual') NOT NULL,
  source     VARCHAR(50) NULL,
  notes      TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email),
  KEY idx_reason (reason),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Campaigns (group multiple sends under one name)
CREATE TABLE IF NOT EXISTS campaigns (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  subject      VARCHAR(255) NOT NULL,
  html_body    MEDIUMTEXT NOT NULL,
  category_id  INT NULL,
  created_by   VARCHAR(255) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_category (category_id),
  KEY idx_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
DROP PROCEDURE IF EXISTS maildeck_alter_campaigns $$
CREATE PROCEDURE maildeck_alter_campaigns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='campaigns' AND COLUMN_NAME='status') THEN
    ALTER TABLE campaigns ADD COLUMN status ENUM('draft','active','archived') NOT NULL DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='campaigns' AND COLUMN_NAME='preview_text') THEN
    ALTER TABLE campaigns ADD COLUMN preview_text VARCHAR(255) NULL;
  END IF;
END $$
CALL maildeck_alter_campaigns() $$
DROP PROCEDURE maildeck_alter_campaigns $$
DELIMITER ;


-- Persistent send-job queue (replaces in-memory progress)
CREATE TABLE IF NOT EXISTS email_jobs (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id    BIGINT NULL,
  source         ENUM('all','category','excel','segment','manual') NOT NULL,
  filter_json    JSON NULL,
  subject        VARCHAR(255) NOT NULL,
  html_body      MEDIUMTEXT NOT NULL,
  total          INT NOT NULL DEFAULT 0,
  sent           INT NOT NULL DEFAULT 0,
  failed         INT NOT NULL DEFAULT 0,
  skipped        INT NOT NULL DEFAULT 0,
  status         ENUM('queued','running','paused','cancelled','completed','failed') NOT NULL DEFAULT 'queued',
  rate_limit     INT NOT NULL DEFAULT 10,
  monitor_email  VARCHAR(255) NULL,
  monitor_every  INT NULL,
  schedule_at    DATETIME NULL,
  cancelled_at   DATETIME NULL,
  started_at     DATETIME NULL,
  finished_at    DATETIME NULL,
  last_error     TEXT NULL,
  created_by     VARCHAR(255) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_status (status),
  KEY idx_schedule (schedule_at),
  KEY idx_created  (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
DROP PROCEDURE IF EXISTS maildeck_alter_jobs $$
CREATE PROCEDURE maildeck_alter_jobs()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='email_jobs' AND COLUMN_NAME='name') THEN
    ALTER TABLE email_jobs ADD COLUMN name VARCHAR(255) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='email_jobs' AND COLUMN_NAME='sender_id') THEN
    ALTER TABLE email_jobs ADD COLUMN sender_id INT NULL, ADD KEY idx_sender (sender_id);
  END IF;
END $$
CALL maildeck_alter_jobs() $$
DROP PROCEDURE maildeck_alter_jobs $$
DELIMITER ;


CREATE TABLE IF NOT EXISTS email_job_recipients (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_id          BIGINT NOT NULL,
  email           VARCHAR(255) NOT NULL,
  status          ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
  ses_message_id  VARCHAR(100) NULL,
  error           TEXT NULL,
  attempts        TINYINT NOT NULL DEFAULT 0,
  sent_at         DATETIME NULL,
  KEY idx_job_status (job_id, status),
  KEY idx_messageid  (ses_message_id),
  CONSTRAINT fk_jr_job FOREIGN KEY (job_id) REFERENCES email_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Reusable templates / autosaved drafts / saved filter segments
CREATE TABLE IF NOT EXISTS email_templates (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  subject    VARCHAR(255) NULL,
  html_body  MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_drafts (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_email  VARCHAR(255) NOT NULL,
  subject     VARCHAR(255) NULL,
  html_body   MEDIUMTEXT NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_user (user_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_segments (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  filter_json JSON NOT NULL,
  created_by  VARCHAR(255) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Audit trail of admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor        VARCHAR(255) NULL,
  action       VARCHAR(100) NOT NULL,
  target_type  VARCHAR(50) NULL,
  target_id    VARCHAR(100) NULL,
  payload      JSON NULL,
  ip           VARCHAR(64) NULL,
  user_agent   VARCHAR(500) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_action_time (action, created_at),
  KEY idx_actor_time  (actor, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Key/value app settings (seeded below)
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(100) NOT NULL,
  setting_value TEXT NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Many-to-many category membership (replaces single emails.category_id)
CREATE TABLE IF NOT EXISTS email_categories (
  email_id    INT NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email_id, category_id),
  KEY idx_category_email (category_id, email_id),
  CONSTRAINT fk_ec_email    FOREIGN KEY (email_id)    REFERENCES emails(id)     ON DELETE CASCADE,
  CONSTRAINT fk_ec_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: copy any pre-existing emails.category_id into the join table
INSERT IGNORE INTO email_categories (email_id, category_id)
SELECT e.id, e.category_id
FROM emails e
INNER JOIN categories c ON c.id = e.category_id
WHERE e.category_id IS NOT NULL AND (e.deleted_at IS NULL);


-- Subscriber tags (flat label cloud, separate from categories)
CREATE TABLE IF NOT EXISTS subscriber_tags (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(64) NOT NULL,
  color      VARCHAR(9)  NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tag_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_tag_links (
  email_id   INT NOT NULL,
  tag_id     INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email_id, tag_id),
  KEY idx_tag (tag_id),
  CONSTRAINT fk_etl_email FOREIGN KEY (email_id) REFERENCES emails(id)         ON DELETE CASCADE,
  CONSTRAINT fk_etl_tag   FOREIGN KEY (tag_id)   REFERENCES subscriber_tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Admin accounts (future auth wiring)
CREATE TABLE IF NOT EXISTS app_users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  name          VARCHAR(120) NULL,
  role          ENUM('admin','editor','viewer') NOT NULL DEFAULT 'admin',
  password_hash VARCHAR(255) NULL,
  last_seen_at  DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- API keys for programmatic access
CREATE TABLE IF NOT EXISTS api_keys (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  key_prefix    VARCHAR(12)  NOT NULL,
  key_hash      VARCHAR(128) NOT NULL,
  last_used_at  DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at    DATETIME NULL,
  KEY idx_prefix (key_prefix)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Outbound webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  url            VARCHAR(500) NOT NULL,
  events         JSON NOT NULL,
  secret         VARCHAR(120) NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_fired_at  DATETIME NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  kind       VARCHAR(40)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT NULL,
  link       VARCHAR(500) NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_unread (is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Sender identities (multiple verified SES From addresses)
CREATE TABLE IF NOT EXISTS email_senders (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(255) NOT NULL,
  display_name    VARCHAR(120) NOT NULL,
  reply_to        VARCHAR(255) NULL,
  is_default      TINYINT(1)   NOT NULL DEFAULT 0,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  ses_verified    TINYINT(1)   NOT NULL DEFAULT 0,
  ses_verified_at DATETIME NULL,
  notes           TEXT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sender_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================================
-- 5. Seed data
-- ============================================================================

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('default_rate_limit',   '10'),
  ('default_monitor_email',''),
  ('default_monitor_every','1000'),
  ('sender_name',          'Race Auto India');

INSERT IGNORE INTO email_senders (email, display_name, is_default, ses_verified) VALUES
  ('marketing@raceautoindia.com', 'Race Auto India', 1, 1);


-- ============================================================================
-- 6. Repair any orphan emails.category_id values (point to deleted categories)
-- ============================================================================

UPDATE emails e
LEFT JOIN categories c ON c.id = e.category_id AND c.deleted_at IS NULL
SET e.category_id = NULL
WHERE c.id IS NULL AND e.category_id IS NOT NULL;
