import { NextResponse } from "next/server";
import db from "@/lib/db";

// Aggregate insights for the date range:
//  - top clicked links (last 14 days within range)
//  - per-domain engagement breakdown
//  - top recipients by activity
//  - daily timeline
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const jobId = searchParams.get("jobId");
  const campaignId = searchParams.get("campaignId");
  if (!from || !to) {
    return NextResponse.json({ error: "Missing from/to" }, { status: 400 });
  }

  const baseWhere = ["eventTime >= ?", "eventTime < DATE_ADD(?, INTERVAL 1 DAY)"];
  const baseParams = [from, to];
  if (jobId && jobId !== "untagged") {
    baseWhere.push("job_id = ?"); baseParams.push(Number(jobId));
  } else if (jobId === "untagged") {
    baseWhere.push("job_id IS NULL");
  }
  if (campaignId && campaignId !== "untagged") {
    baseWhere.push("campaign_id = ?"); baseParams.push(Number(campaignId));
  } else if (campaignId === "untagged") {
    baseWhere.push("campaign_id IS NULL");
  }
  const where = baseWhere.join(" AND ");

  // Top clicked links
  const [topLinks] = await db.query(
    `SELECT link, COUNT(*) AS clicks, COUNT(DISTINCT email) AS unique_clickers
     FROM email_events
     WHERE ${where} AND status = 'Click' AND link IS NOT NULL AND link <> ''
     GROUP BY link
     ORDER BY clicks DESC
     LIMIT 10`,
    baseParams
  );

  // Per-domain breakdown
  const [domains] = await db.query(
    `SELECT
        SUBSTRING_INDEX(email, '@', -1) AS domain,
        COUNT(*) AS events,
        SUM(status = 'Sent')      AS sent,
        SUM(status = 'Delivery')  AS delivered,
        SUM(status = 'Open')      AS opened,
        SUM(status = 'Click')     AS clicked,
        SUM(status = 'Bounce')    AS bounced,
        SUM(status = 'Complaint') AS complaints
     FROM email_events
     WHERE ${where}
     GROUP BY domain
     ORDER BY events DESC
     LIMIT 10`,
    baseParams
  );

  // Top recipients
  const [topRecipients] = await db.query(
    `SELECT email,
        COUNT(*) AS events,
        SUM(status = 'Open')   AS opens,
        SUM(status = 'Click')  AS clicks,
        SUM(status = 'Bounce') AS bounces
     FROM email_events
     WHERE ${where}
     GROUP BY email
     ORDER BY clicks DESC, opens DESC
     LIMIT 10`,
    baseParams
  );

  // Daily timeline
  const [timeline] = await db.query(
    `SELECT DATE(eventTime) AS day,
        SUM(status = 'Sent')     AS sent,
        SUM(status = 'Delivery') AS delivered,
        SUM(status = 'Open')     AS opened,
        SUM(status = 'Click')    AS clicked,
        SUM(status = 'Bounce')   AS bounced
     FROM email_events
     WHERE ${where}
     GROUP BY day
     ORDER BY day ASC`,
    baseParams
  );

  // Hour-of-day open distribution (when do recipients open?)
  const [hourly] = await db.query(
    `SELECT HOUR(eventTime) AS hour, COUNT(*) AS opens
     FROM email_events
     WHERE ${where} AND status IN ('Open','Click')
     GROUP BY hour
     ORDER BY hour ASC`,
    baseParams
  );

  return NextResponse.json({
    topLinks: topLinks.map(r => ({ ...r, clicks: Number(r.clicks), unique_clickers: Number(r.unique_clickers) })),
    domains: domains.map(r => ({
      domain: r.domain,
      events: Number(r.events),
      sent: Number(r.sent), delivered: Number(r.delivered),
      opened: Number(r.opened), clicked: Number(r.clicked),
      bounced: Number(r.bounced), complaints: Number(r.complaints),
    })),
    topRecipients: topRecipients.map(r => ({
      ...r, events: Number(r.events),
      opens: Number(r.opens), clicks: Number(r.clicks), bounces: Number(r.bounces),
    })),
    timeline: timeline.map(r => ({
      day: r.day,
      sent: Number(r.sent), delivered: Number(r.delivered),
      opened: Number(r.opened), clicked: Number(r.clicked), bounced: Number(r.bounced),
    })),
    hourly: hourly.map(r => ({ hour: Number(r.hour), opens: Number(r.opens) })),
  });
}
