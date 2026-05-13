import { NextResponse } from "next/server";
import db from "@/lib/db";
import "@/lib/workerBoot";

export async function POST(_req, context) {
  const { params } = await context;
  const id = Number(params.id);

  const [res] = await db.execute(
    `UPDATE email_job_recipients SET status='pending', error=NULL WHERE job_id = ? AND status = 'failed'`,
    [id]
  );
  if (res.affectedRows > 0) {
    await db.execute(
      `UPDATE email_jobs
       SET failed = GREATEST(failed - ?, 0),
           status = CASE WHEN status IN ('completed','failed') THEN 'queued' ELSE status END,
           finished_at = NULL
       WHERE id = ?`,
      [res.affectedRows, id]
    );
  }
  return NextResponse.json({ success: true, requeued: res.affectedRows });
}
