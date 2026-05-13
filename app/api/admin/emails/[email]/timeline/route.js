import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req) {
  const { pathname } = new URL(req.url);
  const parts = pathname.split("/");
  const email = decodeURIComponent(parts[parts.length - 2]);

  const [[row]] = await db.query(
    `SELECT id, email, subscribe, created_at, last_event_at, last_event_status,
            first_name, last_name, notes, engagement_score, last_sent_at
     FROM emails WHERE email = ? LIMIT 1`,
    [email]
  );
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [events] = await db.query(
    `SELECT messageId, status, link, ip, userAgent, eventTime, subject, job_id, campaign_id
     FROM email_events
     WHERE email = ?
     ORDER BY eventTime DESC LIMIT 200`,
    [email]
  );

  const [[counts]] = await db.query(
    `SELECT
        COUNT(*) AS total,
        SUM(status='Sent') AS sent,
        SUM(status='Delivery') AS delivered,
        SUM(status='Open') AS opened,
        SUM(status='Click') AS clicked,
        SUM(status='Bounce') AS bounced,
        SUM(status='Complaint') AS complaints
     FROM email_events WHERE email = ?`,
    [email]
  );

  const [cats] = await db.query(
    `SELECT c.id, c.name, c.color
     FROM email_categories ec
     INNER JOIN categories c ON c.id = ec.category_id AND c.deleted_at IS NULL
     WHERE ec.email_id = ?`,
    [row.id]
  );

  const [suppressed] = await db.query(
    `SELECT reason, source, notes, created_at FROM email_suppressions WHERE email = ?`,
    [email]
  );

  return NextResponse.json({
    subscriber: row,
    categories: cats,
    suppressed: suppressed[0] || null,
    counts: {
      total: Number(counts.total) || 0,
      sent: Number(counts.sent) || 0,
      delivered: Number(counts.delivered) || 0,
      opened: Number(counts.opened) || 0,
      clicked: Number(counts.clicked) || 0,
      bounced: Number(counts.bounced) || 0,
      complaints: Number(counts.complaints) || 0,
    },
    events,
  });
}

export async function PATCH(req) {
  const { pathname } = new URL(req.url);
  const parts = pathname.split("/");
  const email = decodeURIComponent(parts[parts.length - 2]);

  const body = await req.json();
  const fields = [];
  const params = [];
  if ("first_name" in body) { fields.push("first_name = ?"); params.push(body.first_name || null); }
  if ("last_name"  in body) { fields.push("last_name  = ?"); params.push(body.last_name  || null); }
  if ("notes"      in body) { fields.push("notes      = ?"); params.push(body.notes      || null); }
  if ("subscribe"  in body) { fields.push("subscribe  = ?"); params.push(body.subscribe ? 1 : 0); }

  if (!fields.length) return NextResponse.json({ success: true, updated: 0 });
  params.push(email);
  const [res] = await db.execute(
    `UPDATE emails SET ${fields.join(", ")}, updated_at = NOW() WHERE email = ?`,
    params
  );
  return NextResponse.json({ success: true, updated: res.affectedRows });
}
