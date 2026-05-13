-- 001_safety_indexes_emails.sql
-- Adds safe indexes + audit columns to existing `emails` table.
-- All operations are guarded so this migration is idempotent.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_001 $$
CREATE PROCEDURE migrate_001()
BEGIN
  -- email UNIQUE
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND INDEX_NAME = 'uq_emails_email'
  ) THEN
    ALTER TABLE emails ADD UNIQUE KEY uq_emails_email (email);
  END IF;

  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'created_at'
  ) THEN
    ALTER TABLE emails ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'updated_at'
  ) THEN
    ALTER TABLE emails ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
  END IF;

  -- deleted_at (soft delete)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'deleted_at'
  ) THEN
    ALTER TABLE emails ADD COLUMN deleted_at DATETIME NULL;
  END IF;

  -- last_event_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'last_event_at'
  ) THEN
    ALTER TABLE emails ADD COLUMN last_event_at DATETIME NULL;
  END IF;

  -- last_event_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'last_event_status'
  ) THEN
    ALTER TABLE emails ADD COLUMN last_event_status VARCHAR(20) NULL;
  END IF;

  -- first_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'first_name'
  ) THEN
    ALTER TABLE emails ADD COLUMN first_name VARCHAR(100) NULL;
  END IF;

  -- last_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND COLUMN_NAME = 'last_name'
  ) THEN
    ALTER TABLE emails ADD COLUMN last_name VARCHAR(100) NULL;
  END IF;

  -- composite index (category_id, subscribe)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND INDEX_NAME = 'idx_category_subscribe'
  ) THEN
    ALTER TABLE emails ADD KEY idx_category_subscribe (category_id, subscribe);
  END IF;

  -- index on subscribe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND INDEX_NAME = 'idx_subscribe'
  ) THEN
    ALTER TABLE emails ADD KEY idx_subscribe (subscribe);
  END IF;

  -- index on last_event_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND INDEX_NAME = 'idx_last_event_at'
  ) THEN
    ALTER TABLE emails ADD KEY idx_last_event_at (last_event_at);
  END IF;

  -- index on created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emails' AND INDEX_NAME = 'idx_created_at'
  ) THEN
    ALTER TABLE emails ADD KEY idx_created_at (created_at);
  END IF;
END $$

CALL migrate_001() $$
DROP PROCEDURE migrate_001 $$

DELIMITER ;
