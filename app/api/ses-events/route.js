import { NextResponse } from "next/server";
import https from "https";
import db from "@/lib/db";
import { addSuppressions } from "@/lib/suppression";

async function parseBody(req) {
  const reader = req.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

const statusRank = {
  Delivery: 1,
  Open: 2,
  Click: 3,
  Bounce: 4,
  Complaint: 5,
};

async function syncLastEvent(email, status, eventTime) {
  try {
    await db.execute(
      `UPDATE emails
       SET last_event_status = ?, last_event_at = ?
       WHERE email = ?
         AND (last_event_at IS NULL OR last_event_at <= ?)`,
      [status, eventTime, email, eventTime]
    );
  } catch (err) {
    console.warn("syncLastEvent failed:", err.message);
  }
}

async function autoSuppress(email, eventType, snsMessage) {
  try {
    if (eventType === "Bounce") {
      const bounceType = snsMessage?.bounce?.bounceType;
      if (bounceType === "Permanent") {
        await addSuppressions([{ email, reason: "bounce", source: "ses-sns" }]);
        await db.execute(`UPDATE emails SET subscribe = 0 WHERE email = ?`, [email]);
      }
    } else if (eventType === "Complaint") {
      await addSuppressions([{ email, reason: "complaint", source: "ses-sns" }]);
      await db.execute(`UPDATE emails SET subscribe = 0 WHERE email = ?`, [email]);
    }
  } catch (err) {
    console.warn("autoSuppress failed:", err.message);
  }
}

export async function POST(req) {
  try {
    const messageType = req.headers.get("x-amz-sns-message-type");
    const rawBody = await parseBody(req);

    if (messageType === "SubscriptionConfirmation") {
      const { SubscribeURL } = JSON.parse(rawBody);
      // SubscribeURL is provided by AWS only over HTTPS to amazonaws.com domains.
      if (SubscribeURL && /^https:\/\/[a-z0-9.-]+\.amazonaws\.com\//i.test(SubscribeURL)) {
        https.get(SubscribeURL, () => {
          console.log("✅ SNS subscription confirmed");
        });
        return NextResponse.json({ message: "Subscribed" });
      }
      return NextResponse.json({ error: "Invalid SubscribeURL" }, { status: 400 });
    }

    if (messageType === "Notification") {
      const snsMessage = JSON.parse(JSON.parse(rawBody).Message);
      const eventType = snsMessage.eventType || snsMessage.notificationType || "unknown";
      const messageId = snsMessage.mail?.messageId || "unknown";
      const email = snsMessage.mail?.destination?.[0] || "unknown";
      const eventTime = new Date(snsMessage.mail?.timestamp || Date.now());

      let link = null;
      let ip = null;
      let userAgent = null;
      if (eventType === "Click") {
        link = snsMessage.click?.link || null;
        ip = snsMessage.click?.ipAddress || null;
        userAgent = snsMessage.click?.userAgent || null;
      } else if (eventType === "Open") {
        ip = snsMessage.open?.ipAddress || null;
        userAgent = snsMessage.open?.userAgent || null;
      }

      const [rows] = await db.query(
        `SELECT status, job_id, campaign_id FROM email_events WHERE messageId = ?`,
        [messageId]
      );
      const existing = rows[0];
      const incomingRank = statusRank[eventType] ?? 0;
      const existingRank = statusRank[existing?.status] ?? 0;

      // Lookup the job that produced this messageId (worker writes ses_message_id).
      let jobId = existing?.job_id || null;
      let campaignId = existing?.campaign_id || null;
      if (!jobId && messageId !== "unknown") {
        try {
          const [jr] = await db.query(
            `SELECT r.job_id, j.campaign_id
             FROM email_job_recipients r
             LEFT JOIN email_jobs j ON j.id = r.job_id
             WHERE r.ses_message_id = ?
             LIMIT 1`,
            [messageId]
          );
          if (jr[0]) {
            jobId = jr[0].job_id || null;
            campaignId = jr[0].campaign_id || null;
          }
        } catch (_) { /* non-fatal */ }
      }

      if (!existing) {
        await db.query(
          `INSERT INTO email_events
           (messageId, email, status, link, ip, userAgent, eventTime, job_id, campaign_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [messageId, email, eventType, link, ip, userAgent, eventTime, jobId, campaignId]
        );
      } else if (incomingRank > existingRank) {
        await db.query(
          `UPDATE email_events
           SET status = ?, link = ?, ip = ?, userAgent = ?, eventTime = ?,
               job_id = COALESCE(job_id, ?), campaign_id = COALESCE(campaign_id, ?)
           WHERE messageId = ?`,
          [eventType, link, ip, userAgent, eventTime, jobId, campaignId, messageId]
        );
      } else if (jobId && !existing.job_id) {
        // backfill job_id without overwriting status
        await db.query(
          `UPDATE email_events SET job_id = ?, campaign_id = COALESCE(campaign_id, ?) WHERE messageId = ?`,
          [jobId, campaignId, messageId]
        );
      }

      // sync per-subscriber last event + auto-suppress hard bounces / complaints
      if (email && email !== "unknown") {
        await syncLastEvent(email, eventType, eventTime);
        await autoSuppress(email, eventType, snsMessage);
      }

      return NextResponse.json({ message: "Processed" });
    }

    return NextResponse.json({ message: "Ignored" });
  } catch (err) {
    console.error("❌ SNS error:", err.message);
    return NextResponse.json({ error: "Invalid SNS message" }, { status: 400 });
  }
}
