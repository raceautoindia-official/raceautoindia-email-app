-- 012_email_events_dedupe.sql
-- Deduplicate rows in email_events that share a messageId, then add a UNIQUE
-- key so future writes are protected at the DB layer (allows ON DUPLICATE KEY
-- UPDATE patterns later).
--
-- IMPORTANT: This migration mutates data. Take a backup first.
-- Idempotent: safe to re-run.
--
-- Dedupe rule: for each duplicate messageId, keep the row with the highest
-- status rank (Complaint > Bounce > Click > Open > Delivery > Sent > unknown),
-- breaking ties by the most recent eventTime, then by lowest id.

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_012 $$
CREATE PROCEDURE migrate_012()
BEGIN
  -- Already applied?
  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'email_events'
      AND INDEX_NAME   = 'uq_event_messageid'
  ) THEN
    -- Nothing to do.
    LEAVE migrate_012;
  END IF;

  -- 1. Drop rows whose messageId is NULL/blank/unknown; UNIQUE can't keep them.
  DELETE FROM email_events
  WHERE messageId IS NULL OR messageId = '' OR messageId = 'unknown';

  -- 2. Pick the "best" row per messageId. We materialize ranks first so the
  --    DELETE plan is reasonable on large tables.
  DROP TEMPORARY TABLE IF EXISTS _ee_keep;
  CREATE TEMPORARY TABLE _ee_keep (
    keep_id BIGINT PRIMARY KEY
  ) ENGINE = InnoDB;

  INSERT INTO _ee_keep (keep_id)
  SELECT id FROM (
    SELECT
      e.id,
      ROW_NUMBER() OVER (
        PARTITION BY e.messageId
        ORDER BY
          CASE e.status
            WHEN 'Complaint' THEN 6
            WHEN 'Bounce'    THEN 5
            WHEN 'Click'     THEN 4
            WHEN 'Open'      THEN 3
            WHEN 'Delivery'  THEN 2
            WHEN 'Sent'      THEN 1
            WHEN 'Send'      THEN 1
            ELSE 0
          END DESC,
          e.eventTime DESC,
          e.id ASC
      ) AS rn
    FROM email_events e
  ) ranked
  WHERE rn = 1;

  -- 3. Delete the losers.
  DELETE e FROM email_events e
  LEFT JOIN _ee_keep k ON k.keep_id = e.id
  WHERE k.keep_id IS NULL;

  DROP TEMPORARY TABLE IF EXISTS _ee_keep;

  -- 4. Normalize legacy "Send" rows to "Sent" so the UI's counters see them.
  UPDATE email_events SET status = 'Sent' WHERE status = 'Send';

  -- 5. Add the UNIQUE key.
  ALTER TABLE email_events
    ADD UNIQUE KEY uq_event_messageid (messageId);
END $$

CALL migrate_012() $$
DROP PROCEDURE migrate_012 $$

DELIMITER ;
