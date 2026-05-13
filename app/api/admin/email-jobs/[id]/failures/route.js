import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req, context) {
  const { params } = await context;
  const id = Number(params.id);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Number(searchParams.get("limit")) || 100);
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  const [rows] = await db.query(
    `SELECT email, error, attempts, sent_at
     FROM email_job_recipients
     WHERE job_id = ? AND status = 'failed'
     ORDER BY id ASC LIMIT ${limit} OFFSET ${offset}`,
    [id]
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM email_job_recipients WHERE job_id = ? AND status = 'failed'`,
    [id]
  );
  return NextResponse.json({ rows, total });
}
