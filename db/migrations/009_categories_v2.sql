-- 009_categories_v2.sql
-- Many-to-many categories. Idempotent.
--
-- 1. Adds color/position/deleted_at to categories
-- 2. Creates email_categories join table
-- 3. Backfills from existing emails.category_id (kept for back-compat)

DELIMITER $$

DROP PROCEDURE IF EXISTS migrate_009 $$
CREATE PROCEDURE migrate_009()
BEGIN
  -- color
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'color'
  ) THEN
    ALTER TABLE categories ADD COLUMN color VARCHAR(9) NOT NULL DEFAULT '#6c757d';
  END IF;

  -- position
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'position'
  ) THEN
    ALTER TABLE categories ADD COLUMN position INT NOT NULL DEFAULT 0;
  END IF;

  -- deleted_at (soft delete)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'deleted_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN deleted_at DATETIME NULL;
  END IF;

  -- updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'updated_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
  END IF;

  -- created_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND COLUMN_NAME = 'created_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- unique slug
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categories' AND INDEX_NAME = 'uq_categories_slug'
  ) THEN
    ALTER TABLE categories ADD UNIQUE KEY uq_categories_slug (slug);
  END IF;

  -- seed positions if all 0
  UPDATE categories SET position = id WHERE position = 0;
END $$

CALL migrate_009() $$
DROP PROCEDURE migrate_009 $$

DELIMITER ;

-- Many-to-many join
CREATE TABLE IF NOT EXISTS email_categories (
  email_id INT NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email_id, category_id),
  KEY idx_category_email (category_id, email_id),
  CONSTRAINT fk_ec_email FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE,
  CONSTRAINT fk_ec_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: copy emails.category_id into the join table for any row that hasn't been linked yet
INSERT IGNORE INTO email_categories (email_id, category_id)
SELECT e.id, e.category_id
FROM emails e
INNER JOIN categories c ON c.id = e.category_id
WHERE e.category_id IS NOT NULL
  AND (e.deleted_at IS NULL);
