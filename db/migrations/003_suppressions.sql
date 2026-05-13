-- 003_suppressions.sql
-- Global suppression list (hard bounces, complaints, manual unsubscribes)

CREATE TABLE IF NOT EXISTS email_suppressions (
  email VARCHAR(255) NOT NULL,
  reason ENUM('bounce','complaint','unsubscribe','manual') NOT NULL,
  source VARCHAR(50) NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email),
  KEY idx_reason (reason),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
