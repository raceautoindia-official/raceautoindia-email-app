-- 007_audit_log.sql
-- Tracks every admin action for forensics

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor VARCHAR(255) NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id VARCHAR(100) NULL,
  payload JSON NULL,
  ip VARCHAR(64) NULL,
  user_agent VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_action_time (action, created_at),
  KEY idx_actor_time (actor, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
