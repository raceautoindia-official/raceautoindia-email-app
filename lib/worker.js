import db from "./db";
import { sendOne } from "./awsclient";
import { convert } from "html-to-text";
import { resolveSenderForJob } from "./senders";
import { upsertEmailEvent } from "./emailEvents";

const TICK_MS = Number(process.env.WORKER_TICK_MS) || 500;
const ENABLED = (process.env.WORKER_ENABLED || "true").toLowerCase() !== "false";
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://newsletter.raceautoindia.com";

let started = false;
let runningJobs = new Set();

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function personalize(html, email) {
  const enc = encodeURIComponent(email);
  return (html || "")
    .replaceAll("{{unsubscribe_link}}", `${PUBLIC_BASE_URL}/subscription/unsubscribe?email=${enc}`)
    .replaceAll("{{visible_email}}", email);
}

async function claimNextJob() {
  // Atomic claim: pick one queued job that is not future-scheduled
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id FROM email_jobs
       WHERE status = 'queued'
         AND (schedule_at IS NULL OR schedule_at <= NOW())
       ORDER BY id ASC
       LIMIT 1
       FOR UPDATE`
    );
    if (rows.length === 0) {
      await conn.commit();
      return null;
    }
    const jobId = rows[0].id;
    await conn.execute(
      `UPDATE email_jobs SET status='running', started_at = COALESCE(started_at, NOW()) WHERE id = ?`,
      [jobId]
    );
    await conn.commit();
    return jobId;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function processJob(jobId) {
  const [[job]] = await db.query(`SELECT * FROM email_jobs WHERE id = ?`, [jobId]);
  if (!job) return;

  const rateLimit = Math.max(1, job.rate_limit || 10);
  const pauseMs = 1000 / rateLimit;
  const plain = convert(job.html_body || "", { wordwrap: 130 });
  const monitorEmail = job.monitor_email;
  const monitorEvery = Number(job.monitor_every) || 0;
  const sender = await resolveSenderForJob(job);

  let processedSinceMonitor = 0;

  while (true) {
    // Cooperative cancel/pause check
    const [[state]] = await db.query(
      `SELECT status FROM email_jobs WHERE id = ?`,
      [jobId]
    );
    if (!state) return;
    if (state.status === "cancelled") return;
    if (state.status === "paused") {
      await db.execute(`UPDATE email_jobs SET status='paused' WHERE id = ?`, [jobId]);
      return;
    }

    // Pull next batch of pending recipients
    const batchSize = Math.max(1, Math.min(50, rateLimit));
    const [batch] = await db.query(
      `SELECT id, email FROM email_job_recipients
       WHERE job_id = ? AND status = 'pending'
       ORDER BY id ASC LIMIT ${batchSize}`,
      [jobId]
    );
    if (batch.length === 0) {
      await db.execute(
        `UPDATE email_jobs
         SET status = 'completed', finished_at = NOW()
         WHERE id = ? AND status = 'running'`,
        [jobId]
      );
      return;
    }

    for (const r of batch) {
      // re-check cancel inside the batch
      const [[s]] = await db.query(`SELECT status FROM email_jobs WHERE id = ?`, [jobId]);
      if (!s || s.status === "cancelled" || s.status === "paused") return;

      const html = personalize(job.html_body || "", r.email);
      try {
        const { messageId } = await sendOne({
          to: r.email,
          subject: job.subject,
          html,
          plain,
          senderEmail: sender?.email,
          senderName: sender?.display_name,
          replyTo: sender?.reply_to || sender?.email,
        });
        await db.execute(
          `UPDATE email_job_recipients
           SET status='sent', sent_at=NOW(), ses_message_id=?, attempts=attempts+1
           WHERE id = ?`,
          [messageId || null, r.id]
        );
        await db.execute(`UPDATE email_jobs SET sent = sent + 1 WHERE id = ?`, [jobId]);
        // Record the send into email_events tagged with the job_id so the
        // tracking page can filter events per-campaign.
        if (messageId) {
          try {
            await upsertEmailEvent({
              messageId,
              email: r.email,
              subject: job.subject,
              status: "Sent",
              eventTime: new Date(),
              jobId,
              campaignId: job.campaign_id || null,
            });
          } catch (_) { /* non-fatal */ }
        }
      } catch (err) {
        const msg = (err?.message || String(err)).slice(0, 1000);
        await db.execute(
          `UPDATE email_job_recipients
           SET status='failed', error=?, attempts=attempts+1
           WHERE id = ?`,
          [msg, r.id]
        );
        await db.execute(
          `UPDATE email_jobs SET failed = failed + 1, last_error = ? WHERE id = ?`,
          [msg, jobId]
        );
      }

      processedSinceMonitor++;
      if (monitorEmail && monitorEvery > 0 && processedSinceMonitor >= monitorEvery) {
        try {
          const html = personalize(job.html_body || "", monitorEmail);
          await sendOne({
            to: monitorEmail,
            subject: `[Monitor] ${job.subject}`,
            html, plain,
            senderEmail: sender?.email,
            senderName: sender?.display_name,
            replyTo: sender?.reply_to || sender?.email,
          });
        } catch (_) {
          // silent — monitor failures shouldn't kill the run
        }
        processedSinceMonitor = 0;
      }

      await delay(pauseMs);
    }
  }
}

export function startWorker() {
  if (!ENABLED || started) return;
  started = true;
  console.log("📬 email worker started (tick:", TICK_MS, "ms)");

  const tick = async () => {
    try {
      // single-job-at-a-time per process keeps SES rate predictable
      if (runningJobs.size === 0) {
        const jobId = await claimNextJob();
        if (jobId) {
          runningJobs.add(jobId);
          processJob(jobId)
            .catch(async (err) => {
              console.error("worker job error:", err);
              await db.execute(
                `UPDATE email_jobs SET status='failed', last_error=?, finished_at=NOW() WHERE id=?`,
                [String(err.message || err).slice(0, 1000), jobId]
              );
            })
            .finally(() => runningJobs.delete(jobId));
        }
      }
    } catch (err) {
      console.error("worker tick failed:", err);
    } finally {
      setTimeout(tick, TICK_MS);
    }
  };
  setTimeout(tick, TICK_MS);
}
