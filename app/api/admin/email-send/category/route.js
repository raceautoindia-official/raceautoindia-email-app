import { NextResponse } from "next/server";
import db from "@/lib/db";
import { createJob, addRecipients } from "@/lib/jobs";
import { getSuppressedSet } from "@/lib/suppression";
import { resolveSenderForJob } from "@/lib/senders";
import { isFreeMailFromDomain, senderDomainOf, bodyValidation } from "@/lib/deliverability";
import "@/lib/workerBoot";

// Backwards-compatible: kept for existing clients. Now also supports
// multi-category and campaign linkage.
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      subject,
      message,
      category_id,
      category_ids,
      rateLimit = 10,
      monitor_email,
      monitor_every,
      campaign_id,
      campaign_name,
    } = body;

    const ids = Array.isArray(category_ids) && category_ids.length
      ? category_ids.map(Number).filter(Boolean)
      : category_id
      ? [Number(category_id)]
      : [];

    if (!subject || !message || !ids.length) {
      return NextResponse.json(
        { success: false, error: "Missing subject, message or category" },
        { status: 400 }
      );
    }

    const { errors: bodyErrors } = bodyValidation(message);
    if (bodyErrors.length) {
      return NextResponse.json({ success: false, error: bodyErrors.join(" ") }, { status: 400 });
    }

    const sender = await resolveSenderForJob({});
    if (!sender?.email) {
      return NextResponse.json({
        success: false,
        error: "No sender identity configured. Add one under Settings → Sender identities."
      }, { status: 400 });
    }
    if (isFreeMailFromDomain(sender.email)) {
      return NextResponse.json({
        success: false,
        error: `Cannot send from ${sender.email}: DMARC will fail for the @${senderDomainOf(sender.email)} domain. Use a sender on a domain you control.`,
      }, { status: 400 });
    }

    const placeholders = ids.map(() => "?").join(",");
    const [rows] = await db.query(
      `SELECT DISTINCT e.email
       FROM emails e
       INNER JOIN email_categories ec ON ec.email_id = e.id
       WHERE e.subscribe = 1 AND e.deleted_at IS NULL
         AND ec.category_id IN (${placeholders})`,
      ids
    );
    let recipients = Array.from(new Set(rows.map((r) => r.email.toLowerCase())));

    const suppressed = await getSuppressedSet(recipients);
    const skippedCount = suppressed.size;
    recipients = recipients.filter((e) => !suppressed.has(e));

    if (!recipients.length) {
      return NextResponse.json(
        { success: false, error: "No eligible recipients", skippedCount },
        { status: 400 }
      );
    }

    let resolvedCampaignId = null;
    if (campaign_id) {
      const [r] = await db.execute(`SELECT id FROM campaigns WHERE id = ?`, [Number(campaign_id)]);
      if (r.length) resolvedCampaignId = Number(campaign_id);
    } else if (campaign_name && campaign_name.trim()) {
      const [res] = await db.execute(
        `INSERT INTO campaigns (name, subject, html_body, category_id) VALUES (?, ?, ?, ?)`,
        [campaign_name.trim(), subject, message, ids.length === 1 ? ids[0] : null]
      );
      resolvedCampaignId = res.insertId;
    }

    const jobId = await createJob({
      source: "category",
      subject,
      htmlBody: message,
      filterJson: ids.length === 1 ? { category_id: ids[0] } : { category_ids: ids },
      rateLimit,
      monitorEmail: monitor_email || null,
      monitorEvery: monitor_every || null,
      campaignId: resolvedCampaignId,
    });
    await addRecipients(jobId, recipients);
    if (skippedCount > 0) {
      await db.execute(`UPDATE email_jobs SET skipped = ? WHERE id = ?`, [skippedCount, jobId]);
    }

    return NextResponse.json({
      success: true,
      jobId,
      campaignId: resolvedCampaignId,
      sentCount: recipients.length,
      skipped: skippedCount,
    });
  } catch (err) {
    console.error("Category send failed", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
