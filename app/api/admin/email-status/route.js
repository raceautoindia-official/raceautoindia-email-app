import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "100", 10);
  const offset = (page - 1) * limit;
  const status = searchParams.get("status");

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing 'from' or 'to' query parameters" },
      { status: 400 }
    );
  }

  try {
    const queryParams = [from, to];
    let statusCondition = "";
    if (status && status !== "All") {
      statusCondition = " AND status = ?";
      queryParams.push(status);
    }

    // ✅ Paginated records with optional status
    const [records] = await db.query(
      `
      SELECT SQL_CALC_FOUND_ROWS messageId, email, subject, status, link, ip, userAgent, eventTime
      FROM email_events
      WHERE DATE(eventTime) BETWEEN ? AND ?
      ${statusCondition}
      ORDER BY eventTime DESC
      LIMIT ? OFFSET ?
      `,
      [...queryParams, limit, offset]
    );

    // ✅ Total count of filtered records
    const [totalResult] = await db.query(`SELECT FOUND_ROWS() AS total`);
    const total = totalResult[0].total;

    // ✅ Counts for all statuses (not filtered, for summary UI)
    const [statusRows] = await db.query(
      `
      SELECT status, COUNT(*) AS count
      FROM email_events
      WHERE DATE(eventTime) BETWEEN ? AND ?
      GROUP BY status
      `,
      [from, to]
    );

    const counts = {};
    statusRows.forEach(row => {
      counts[row.status] = row.count;
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
