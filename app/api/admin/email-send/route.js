import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as XLSX from "xlsx";
import { createJob, addRecipients } from "@/lib/jobs";
import { getSuppressedSet } from "@/lib/suppression";
import "@/lib/workerBoot";

const MAX_BATCH = 100000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function resolveRecipients({ source, filter }, { excelEmails } = {}) {
  if (source === "excel") return excelEmails || [];

  if (source === "all") {
    const [rows] = await db.query(
      `SELECT email FROM emails
       WHERE subscribe = 1 AND deleted_at IS NULL`
    );
    return rows.map((r) => r.email);
  }

  if (source === "category") {
    const ids = Array.isArray(filter?.category_ids)
      ? filter.category_ids.map((n) => Number(n)).filter(Boolean)
      : filter?.category_id
      ? [Number(filter.category_id)]
      : [];
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await db.query(
      `SELECT DISTINCT e.email
       FROM emails e
       INNER JOIN email_categories ec ON ec.email_id = e.id
       WHERE e.subscribe = 1
         AND e.deleted_at IS NULL
         AND ec.category_id IN (${placeholders})`,
      ids
    );
    return rows.map((r) => r.email);
  }

  if (source === "manual") {
    const list = Array.isArray(filter?.emails) ? filter.emails : [];
    return list
      .map((e) => String(e || "").trim().toLowerCase())
      .filter((e) => EMAIL_RE.test(e));
  }

  return [];
}

async function parseExcel(formData) {
  const file = formData.get("file");
  if (!file || typeof file === "string") return [];
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  return data
    .map((row) => row.email || row.Email || row["Email Address"])
    .map((e) => String(e || "").trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e));
}

async function resolveCampaignId({ campaign_id, campaign_name, subject, html_body, filter }) {
  if (campaign_id) {
    const [r] = await db.execute(`SELECT id FROM campaigns WHERE id = ?`, [Number(campaign_id)]);
    if (r.length) return Number(campaign_id);
  }
  if (campaign_name && campaign_name.trim()) {
    const cat =
      filter?.category_id != null
        ? Number(filter.category_id)
        : Array.isArray(filter?.category_ids) && filter.category_ids.length === 1
        ? Number(filter.category_ids[0])
        : null;
    const [res] = await db.execute(
      `INSERT INTO campaigns (name, subject, html_body, category_id) VALUES (?, ?, ?, ?)`,
      [campaign_name.trim(), subject, html_body, cat]
    );
    return res.insertId;
  }
  return null;
}

export async function POST(req) {
  try {
    const ct = req.headers.get("content-type") || "";
    let body = {};
    let excelEmails = null;

    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      body.subject = fd.get("subject");
      body.message = fd.get("message");
      body.rateLimit = Number(fd.get("rateLimit")) || 10;
      body.source = fd.get("source") || "excel";
      body.campaign_id = fd.get("campaign_id") || null;
      body.campaign_name = fd.get("campaign_name") || null;
      body.sender_id = fd.get("sender_id") || null;
      body.monitor_email = fd.get("monitor_email") || null;
      const monEvery = fd.get("monitor_every");
      body.monitor_every = monEvery ? Number(monEvery) : null;
      body.filter = {};
      const cat = fd.get("category_id");
      const cats = fd.get("category_ids");
      if (cat) body.filter.category_id = Number(cat);
      if (cats) {
        try {
          const parsed = JSON.parse(cats);
          if (Array.isArray(parsed)) body.filter.category_ids = parsed.map(Number);
        } catch {}
      }
      excelEmails = await parseExcel(fd);
    } else {
      body = await req.json();
    }

    const {
      subject,
      message,
      rateLimit = 10,
      source,
      filter = {},
      monitor_email,
      monitor_every,
      scheduleAt,
      campaign_id,
      campaign_name,
      sender_id,
    } = body;

    if (!subject || !message || !source) {
      return NextResponse.json(
        { success: false, error: "Missing subject, message, or source" },
        { status: 400 }
      );
    }

    if (source === "category") {
      const hasCat =
        (Array.isArray(filter?.category_ids) && filter.category_ids.length > 0) ||
        filter?.category_id != null;
      if (!hasCat) {
        return NextResponse.json(
          { success: false, error: "Pick at least one category" },
          { status: 400 }
        );
      }
    }

    let recipients = await resolveRecipients({ source, filter }, { excelEmails });
    recipients = Array.from(new Set(recipients.map((e) => e.toLowerCase())));

    const suppressed = await getSuppressedSet(recipients);
    const skippedCount = suppressed.size;
    recipients = recipients.filter((e) => !suppressed.has(e));

    if (recipients.length === 0) {
      return NextResponse.json(
        { success: false, error: "No eligible recipients", skippedCount },
        { status: 400 }
      );
    }
    if (recipients.length > MAX_BATCH) {
      return NextResponse.json(
        { success: false, error: `Recipient list exceeds limit of ${MAX_BATCH}` },
        { status: 400 }
      );
    }

    const campaignId = await resolveCampaignId({
      campaign_id,
      campaign_name,
      subject,
      html_body: message,
      filter,
    });

    // Validate sender if explicitly chosen — must exist and be SES-verified.
    let senderId = null;
    if (sender_id) {
      const [[s]] = await db.query(
        `SELECT id, ses_verified FROM email_senders WHERE id = ? AND is_active = 1`,
        [Number(sender_id)]
      );
      if (!s) return NextResponse.json({ success: false, error: "Selected sender not found" }, { status: 400 });
      if (!s.ses_verified) {
        return NextResponse.json({
          success: false,
          error: "Selected sender is not verified in SES. Verify it first under Settings → Sender identities."
        }, { status: 400 });
      }
      senderId = s.id;
    }

    const jobId = await createJob({
      source,
      subject,
      htmlBody: message,
      filterJson: filter,
      rateLimit,
      monitorEmail: monitor_email,
      monitorEvery: monitor_every,
      scheduleAt: scheduleAt || null,
      campaignId,
      senderId,
    });
    await addRecipients(jobId, recipients);
    if (skippedCount > 0) {
      await db.execute(`UPDATE email_jobs SET skipped = ? WHERE id = ?`, [skippedCount, jobId]);
    }

    return NextResponse.json({
      success: true,
      jobId,
      campaignId,
      total: recipients.length,
      skipped: skippedCount,
    });
  } catch (err) {
    console.error("email-send error", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal error" },
      { status: 500 }
    );
  }
}
