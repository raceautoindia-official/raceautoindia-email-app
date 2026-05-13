import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createJob, addRecipients } from "@/lib/jobs";
import { getSuppressedSet } from "@/lib/suppression";
import db from "@/lib/db";
import "@/lib/workerBoot";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const config = {
  api: { bodyParser: false },
};

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const subject = formData.get("subject");
    const message = formData.get("message");
    const rateLimit = Number(formData.get("rateLimit")) || 10;
    const monitor_email = formData.get("monitor_email") || null;
    const monitor_every = Number(formData.get("monitor_every")) || null;

    if (!file || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    let emails = data
      .map((row) => row.email || row.Email || row["Email Address"])
      .map((e) => String(e || "").trim().toLowerCase())
      .filter((e) => EMAIL_RE.test(e));

    emails = Array.from(new Set(emails));
    const suppressed = await getSuppressedSet(emails);
    const skippedCount = suppressed.size;
    emails = emails.filter((e) => !suppressed.has(e));

    if (!emails.length) {
      return NextResponse.json(
        { success: false, error: "No eligible recipients", skippedCount },
        { status: 400 }
      );
    }

    const jobId = await createJob({
      source: "excel",
      subject,
      htmlBody: message,
      filterJson: null,
      rateLimit,
      monitorEmail: monitor_email,
      monitorEvery: monitor_every,
    });
    await addRecipients(jobId, emails);
    if (skippedCount > 0) {
      await db.execute(`UPDATE email_jobs SET skipped = ? WHERE id = ?`, [skippedCount, jobId]);
    }

    return NextResponse.json({
      success: true,
      jobId,
      message: `${emails.length} emails queued.`,
      total: emails.length,
      skipped: skippedCount,
    });
  } catch (err) {
    console.error("Excel email send error:", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
