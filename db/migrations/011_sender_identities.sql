-- 011_sender_identities.sql
-- Adds the email_senders table, lets a job pick a sender, and
-- ensures the unsubscribe-driven suppression has a usable source label.

CREATE TABLE IF NOT EXISTS email_senders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  reply_to VARCHAR(255) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  ses_verified TINYINT(1) NOT NULL DEFAULT 0,
  ses_verified_at DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sender_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
DROP PROCEDURE IF EXISTS migrate_011 $$
CREATE PROCEDURE migrate_011()
BEGIN
  -- Allow a job to override the default sender per-send
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_jobs' AND COLUMN_NAME = 'sender_id'
  ) THEN
    ALTER TABLE email_jobs ADD COLUMN sender_id INT NULL,
                           ADD KEY idx_sender (sender_id);
  END IF;
END $$
CALL migrate_011() $$
DROP PROCEDURE migrate_011 $$
DELIMITER ;
