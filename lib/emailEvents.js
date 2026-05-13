import db from "./db";

export const STATUS_RANK = {
  Sent: 1,
  Delivery: 2,
  Open: 3,
  Click: 4,
  Bounce: 5,
  Complaint: 6,
};

// Atomic upsert keyed on messageId. Without a UNIQUE(messageId) constraint we
// serialize concurrent writers per-message via SELECT ... FOR UPDATE so the
// worker's "Sent" insert and the SNS handler's later events can't double-write.
export async function upsertEmailEvent({
  messageId,
  email,
  subject = null,
  status,
  link = null,
  ip = null,
  userAgent = null,
  eventTime,
  jobId = null,
  campaignId = null,
}) {
  if (!messageId || messageId === "unknown") return;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, status, job_id, campaign_id, subject
         FROM email_events
        WHERE messageId = ?
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE`,
      [messageId]
    );
    const existing = rows[0];

    let resolvedJobId = jobId || existing?.job_id || null;
    let resolvedCampaignId = campaignId || existing?.campaign_id || null;
    let resolvedSubject = subject || existing?.subject || null;

    if (!resolvedJobId) {
      try {
        const [jr] = await conn.query(
          `SELECT r.job_id, j.campaign_id, j.subject
             FROM email_job_recipients r
             LEFT JOIN email_jobs j ON j.id = r.job_id
            WHERE r.ses_message_id = ?
            LIMIT 1`,
          [messageId]
        );
        if (jr[0]) {
          resolvedJobId = jr[0].job_id || null;
          resolvedCampaignId = resolvedCampaignId || jr[0].campaign_id || null;
          resolvedSubject = resolvedSubject || jr[0].subject || null;
        }
      } catch {
        /* non-fatal */
      }
    }

    const incomingRank = STATUS_RANK[status] ?? 0;
    const ts = eventTime instanceof Date ? eventTime : new Date(eventTime || Date.now());

    if (!existing) {
      await conn.query(
        `INSERT INTO email_events
           (messageId, email, subject, status, link, ip, userAgent, eventTime, job_id, campaign_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [messageId, email, resolvedSubject, status, link, ip, userAgent, ts, resolvedJobId, resolvedCampaignId]
      );
      await conn.commit();
      return;
    }

    const existingRank = STATUS_RANK[existing.status] ?? 0;

    if (incomingRank > existingRank) {
      await conn.query(
        `UPDATE email_events
            SET status = ?,
                link = COALESCE(?, link),
                ip = COALESCE(?, ip),
                userAgent = COALESCE(?, userAgent),
                eventTime = ?,
                subject = COALESCE(subject, ?),
                job_id = COALESCE(job_id, ?),
                campaign_id = COALESCE(campaign_id, ?)
          WHERE id = ?`,
        [status, link, ip, userAgent, ts, resolvedSubject, resolvedJobId, resolvedCampaignId, existing.id]
      );
    } else {
      await conn.query(
        `UPDATE email_events
            SET subject = COALESCE(subject, ?),
                job_id = COALESCE(job_id, ?),
                campaign_id = COALESCE(campaign_id, ?)
          WHERE id = ?`,
        [resolvedSubject, resolvedJobId, resolvedCampaignId, existing.id]
      );
    }

    await conn.commit();
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}
