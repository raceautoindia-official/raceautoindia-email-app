import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to" }, { status: 400 });
  }
  const [rows] = await db.query(
    `SELECT c.id, c.name, c.subject, c.created_at,
            COUNT(e.id) AS event_count,
            COUNT(DISTINCT e.job_id) AS job_count
     FROM campaigns c
     INNER JOIN email_events e
       ON e.campaign_id = c.id
      AND e.eventTime >= ?
      AND e.eventTime < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY c.id
     ORDER BY c.id DESC`,
    [from, to]
  );
  const [[{ untaggedCount }]] = await db.query(
    `SELECT COUNT(*) AS untaggedCount FROM email_events
     WHERE campaign_id IS NULL
       AND eventTime >= ? AND eventTime < DATE_ADD(?, INTERVAL 1 DAY)`,
    [from, to]
  );
  return NextResponse.json({
    campaigns: rows.map((r) => ({
      ...r,
      event_count: Number(r.event_count) || 0,
      job_count: Number(r.job_count) || 0,
    })),
    untaggedCount: Number(untaggedCount) || 0,
  });
}
