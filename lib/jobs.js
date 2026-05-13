import db from "./db";

export const JOB_STATUS = {
  QUEUED: "queued",
  RUNNING: "running",
  PAUSED: "paused",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  FAILED: "failed",
};

export async function createJob({
  source,
  subject,
  htmlBody,
  filterJson,
  rateLimit,
  monitorEmail,
  monitorEvery,
  scheduleAt,
  campaignId,
  createdBy,
  senderId,
}) {
  const [res] = await db.execute(
    `INSERT INTO email_jobs
     (source, filter_json, subject, html_body, rate_limit, monitor_email, monitor_every, schedule_at, campaign_id, created_by, sender_id, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?, 'queued')`,
    [
      source,
      filterJson ? JSON.stringify(filterJson) : null,
      subject,
      htmlBody,
      Number(rateLimit) || 10,
      monitorEmail || null,
      monitorEvery || null,
      scheduleAt || null,
      campaignId || null,
      createdBy || null,
      senderId || null,
    ]
  );
  return res.insertId;
}

export async function addRecipients(jobId, emails) {
  if (!emails?.length) return 0;
  const CHUNK = 1000;
  let total = 0;
  for (let i = 0; i < emails.length; i += CHUNK) {
    const slice = emails.slice(i, i + CHUNK);
    const values = slice.map((e) => [jobId, e]);
    const [res] = await db.query(
      `INSERT INTO email_job_recipients (job_id, email) VALUES ?`,
      [values]
    );
    total += res.affectedRows || 0;
  }
  await db.execute(`UPDATE email_jobs SET total = ? WHERE id = ?`, [total, jobId]);
  return total;
}

export async function getJob(jobId) {
  const [rows] = await db.execute(`SELECT * FROM email_jobs WHERE id = ?`, [jobId]);
  return rows[0] || null;
}

export async function getJobProgress(jobId) {
  const job = await getJob(jobId);
  if (!job) return null;
  const total = job.total || 0;
  const sent = job.sent || 0;
  const failed = job.failed || 0;
  const skipped = job.skipped || 0;
  const done = sent + failed + skipped;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  let etaSeconds = null;
  if (job.status === "running" && job.started_at && job.rate_limit > 0 && done > 0) {
    const remaining = total - done;
    etaSeconds = Math.ceil(remaining / job.rate_limit);
  }
  return {
    jobId: job.id,
    status: job.status,
    total,
    sent,
    failed,
    skipped,
    done,
    percent,
    rateLimit: job.rate_limit,
    etaSeconds,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    cancelledAt: job.cancelled_at,
    lastError: job.last_error,
    subject: job.subject,
    source: job.source,
  };
}

export async function cancelJob(jobId) {
  const [res] = await db.execute(
    `UPDATE email_jobs
     SET status = 'cancelled', cancelled_at = NOW(), finished_at = NOW()
     WHERE id = ? AND status IN ('queued','running','paused')`,
    [jobId]
  );
  return res.affectedRows > 0;
}

export async function pauseJob(jobId) {
  const [res] = await db.execute(
    `UPDATE email_jobs SET status = 'paused' WHERE id = ? AND status = 'running'`,
    [jobId]
  );
  return res.affectedRows > 0;
}

export async function resumeJob(jobId) {
  const [res] = await db.execute(
    `UPDATE email_jobs SET status = 'queued' WHERE id = ? AND status = 'paused'`,
    [jobId]
  );
  return res.affectedRows > 0;
}

export async function listJobs({ limit = 50, offset = 0, status } = {}) {
  const params = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(status);
  }
  const lim = Math.max(1, Math.min(200, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);
  const [rows] = await db.query(
    `SELECT id, source, subject, total, sent, failed, skipped, status,
            rate_limit, started_at, finished_at, cancelled_at, created_at
     FROM email_jobs ${where}
     ORDER BY id DESC LIMIT ${lim} OFFSET ${off}`,
    params
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM email_jobs ${where}`,
    params
  );
  return { rows, total };
}
