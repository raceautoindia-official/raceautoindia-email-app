-- 005_jobs.sql
-- Persistent send-job queue + per-recipient state.
-- Replaces the in-memory progressStore / cancelMap.

CREATE TABLE IF NOT EXISTS email_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT NULL,
  source ENUM('all','category','excel','segment','manual') NOT NULL,
  filter_json JSON NULL,
  subject VARCHAR(255) NOT NULL,
  html_body MEDIUMTEXT NOT NULL,
  total INT NOT NULL DEFAULT 0,
  sent INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  status ENUM('queued','running','paused','cancelled','completed','failed') NOT NULL DEFAULT 'queued',
  rate_limit INT NOT NULL DEFAULT 10,
  monitor_email VARCHAR(255) NULL,
  monitor_every INT NULL,
  schedule_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  last_error TEXT NULL,
  created_by VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_status (status),
  KEY idx_schedule (schedule_at),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_job_recipients (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_id BIGINT NOT NULL,
  email VARCHAR(255) NOT NULL,
  status ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
  ses_message_id VARCHAR(100) NULL,
  error TEXT NULL,
  attempts TINYINT NOT NULL DEFAULT 0,
  sent_at DATETIME NULL,
  KEY idx_job_status (job_id, status),
  KEY idx_messageid (ses_message_id),
  CONSTRAINT fk_jr_job FOREIGN KEY (job_id) REFERENCES email_jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
