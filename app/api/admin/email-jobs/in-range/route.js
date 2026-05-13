import { NextResponse } from "next/server";
import db from "@/lib/db";

// Returns jobs that have at least one event (or were created) in the given date range.
// Used by the tracking page to populate the per-campaign filter.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to" }, { status: 400 });
  }

  // 1) Jobs that have events in the range (preferred — uses email_events.job_id)
  const [eventJobs] = await db.query(
    `SELECT j.id,
            j.subject,
            j.source,
            j.status AS job_status,
            j.total,
            j.sent,
            j.failed,
            j.created_at,
            COUNT(e.id) AS event_count
     FROM email_jobs j
     INNER JOIN email_events e
       ON e.job_id = j.id
      AND e.eventTime >= ?
      AND e.eventTime < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY j.id
     ORDER BY j.id DESC`,
    [from, to]
  );

  // 2) Also include jobs that were *created* in the range but have no events yet
  //    (so freshly queued/in-flight runs still show up in the dropdown).
  const [createdJobs] = await db.query(
    `SELECT id, subject, source, status AS job_status, total, sent, failed, created_at,
            0 AS event_count
     FROM email_jobs
     WHERE created_at >= ?
       AND created_at < DATE_ADD(?, INTERVAL 1 DAY)
       AND id NOT IN (SELECT DISTINCT job_id FROM email_events
                      WHERE job_id IS NOT NULL
                        AND eventTime >= ?
                        AND eventTime < DATE_ADD(?, INTERVAL 1 DAY))`,
    [from, to, from, to]
  );

  // 3) Count events with no job link (legacy / pre-job-tracking sends)
  const [[{ untaggedCount }]] = await db.query(
    `SELECT COUNT(*) AS untaggedCount FROM email_events
     WHERE job_id IS NULL
       AND eventTime >= ? AND eventTime < DATE_ADD(?, INTERVAL 1 DAY)`,
    [from, to]
  );

  const merged = [
    ...eventJobs.map((j) => ({ ...j, event_count: Number(j.event_count) || 0 })),
    ...createdJobs.map((j) => ({ ...j, event_count: 0 })),
  ];

  return NextResponse.json({
    jobs: merged,
    untaggedCount: Number(untaggedCount) || 0,
  });
}
