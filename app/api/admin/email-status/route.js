import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100000, parseInt(searchParams.get("limit") || "100", 10)));
  const offset = (page - 1) * limit;
  const status = searchParams.get("status");
  const q = (searchParams.get("q") || "").trim();
  const jobId = searchParams.get("jobId");
  const campaignId = searchParams.get("campaignId");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing 'from' or 'to' query parameters" },
      { status: 400 }
    );
  }

  try {
    const where = ["eventTime >= ?", "eventTime < DATE_ADD(?, INTERVAL 1 DAY)"];
    const params = [from, to];
    if (status && status !== "All") {
      where.push("status = ?");
      params.push(status);
    }
    if (q) {
      where.push("email LIKE ?");
      params.push(`%${q}%`);
    }
    if (jobId) {
      if (jobId === "untagged") {
        where.push("job_id IS NULL");
      } else {
        where.push("job_id = ?");
        params.push(Number(jobId));
      }
    }
    if (campaignId) {
      if (campaignId === "untagged") {
        where.push("campaign_id IS NULL");
      } else {
        where.push("campaign_id = ?");
        params.push(Number(campaignId));
      }
    }
    const whereSql = where.join(" AND ");

    const [records] = await db.query(
      `SELECT messageId, email, subject, status, link, ip, userAgent, eventTime,
              job_id, campaign_id
       FROM email_events
       WHERE ${whereSql}
       ORDER BY eventTime DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM email_events WHERE ${whereSql}`,
      params
    );

    // counts ignore status filter so summary always shows all buckets in range
    const countWhere = ["eventTime >= ?", "eventTime < DATE_ADD(?, INTERVAL 1 DAY)"];
    const countParams = [from, to];
    if (q) {
      countWhere.push("email LIKE ?");
      countParams.push(`%${q}%`);
    }
    if (jobId) {
      if (jobId === "untagged") {
        countWhere.push("job_id IS NULL");
      } else {
        countWhere.push("job_id = ?");
        countParams.push(Number(jobId));
      }
    }
    if (campaignId) {
      if (campaignId === "untagged") {
        countWhere.push("campaign_id IS NULL");
      } else {
        countWhere.push("campaign_id = ?");
        countParams.push(Number(campaignId));
      }
    }
    const [statusRows] = await db.query(
      `SELECT status, COUNT(*) AS count
       FROM email_events
       WHERE ${countWhere.join(" AND ")}
       GROUP BY status`,
      countParams
    );
    const counts = {};
    statusRows.forEach((r) => {
      counts[r.status] = Number(r.count);
    });

    return NextResponse.json({
      records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      counts,
    });
  } catch (err) {
    console.error("DB query error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
