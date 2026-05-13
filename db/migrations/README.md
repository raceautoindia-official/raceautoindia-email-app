# Database Migrations

These migrations are **additive and idempotent** — every `ALTER`/`CREATE` is wrapped in checks so it is safe to re-run.

## How to apply

Run them in order against your `bulk_email` MySQL database:

```bash
mysql -u race_user -p bulk_email < db/migrations/001_safety_indexes_emails.sql
mysql -u race_user -p bulk_email < db/migrations/002_email_events_indexes.sql
mysql -u race_user -p bulk_email < db/migrations/003_suppressions.sql
mysql -u race_user -p bulk_email < db/migrations/004_campaigns.sql
mysql -u race_user -p bulk_email < db/migrations/005_jobs.sql
mysql -u race_user -p bulk_email < db/migrations/006_templates_drafts_segments.sql
mysql -u race_user -p bulk_email < db/migrations/007_audit_log.sql
mysql -u race_user -p bulk_email < db/migrations/008_settings.sql
```

Or run all at once:

```bash
cat db/migrations/*.sql | mysql -u race_user -p bulk_email
```

## Notes

- Migrations only ADD tables, columns, and indexes. They never DROP or rename existing data.
- Every statement uses `IF NOT EXISTS` or stored-procedure guards, so reruns are safe.
- After running, restart the Next.js app so the new pool config & worker pick up.
