-- 002_email_events_indexes.sql
-- Adds indexes and job/campaign linkage to email_events. Idempotent.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_002 $$
CREATE PROCEDURE migrate_002()
BEGIN
  -- job_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_events' AND COLUMN_NAME = 'job_id'
  ) THEN
    ALTER TABLE email_events ADD COLUMN job_id BIGINT NULL;
  END IF;

  -- campaign_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_events' AND COLUMN_NAME = 'campaign_id'
  ) THEN
    ALTER TABLE email_events ADD COLUMN campaign_id BIGINT NULL;
  END IF;

  -- idx_event_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_events' AND INDEX_NAME = 'idx_event_time'
  ) THEN
    ALTER TABLE email_events ADD KEY idx_event_time (eventTime);
  END IF;

  -- idx_status_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_events' AND INDEX_NAME = 'idx_status_time'
  ) THEN
    ALTER TABLE email_events ADD KEY idx_status_time (status, eventTime);
  END IF;

  -- idx_email_time
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_events' AND INDEX_NAME = 'idx_email_time'
  ) THEN
    ALTER TABLE email_events ADD KEY idx_email_time (email, eventTime);
  END IF;

  -- idx_job
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_events' AND INDEX_NAME = 'idx_job'
  ) THEN
    ALTER TABLE email_events ADD KEY idx_job (job_id);
  END IF;

  -- idx_campaign
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_events' AND INDEX_NAME = 'idx_campaign'
  ) THEN
    ALTER TABLE email_events ADD KEY idx_campaign (campaign_id);
  END IF;
END $$

CALL migrate_002() $$
DROP PROCEDURE migrate_002 $$

DELIMITER ;
