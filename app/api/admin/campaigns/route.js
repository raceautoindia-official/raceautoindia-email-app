import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const withStats = searchParams.get("with_stats") === "1";
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 100));

  const where = [];
  const params = [];
  if (q) {
    where.push("(c.name LIKE ? OR c.subject LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  if (withStats) {
    const [rows] = await db.query(
      `SELECT c.id, c.name, c.subject, c.category_id, c.created_at, c.updated_at,
              COUNT(j.id) AS job_count,
              COALESCE(SUM(j.total), 0)  AS total_recipients,
              COALESCE(SUM(j.sent), 0)   AS total_sent,
              COALESCE(SUM(j.failed), 0) AS total_failed
       FROM campaigns c
       LEFT JOIN email_jobs j ON j.campaign_id = c.id
       ${whereSql}
       GROUP BY c.id
       ORDER BY c.id DESC
       LIMIT ${limit}`,
      params
    );
    return NextResponse.json(rows);
  }

  const [rows] = await db.query(
    `SELECT id, name, subject, category_id, created_at, updated_at
     FROM campaigns c
     ${whereSql}
     ORDER BY id DESC LIMIT ${limit}`,
    params
  );
  return NextResponse.json(rows);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const name = (body?.name || "").toString().trim();
    const subject = (body?.subject || "").toString().trim();
    const html_body = (body?.html_body || "").toString();
    const category_id = body?.category_id != null ? Number(body.category_id) : null;
    if (!name || !subject) {
      return NextResponse.json({ error: "name and subject required" }, { status: 400 });
    }
    const [res] = await db.execute(
      `INSERT INTO campaigns (name, subject, html_body, category_id) VALUES (?, ?, ?, ?)`,
      [name, subject, html_body, category_id]
    );
    const [rows] = await db.execute(`SELECT * FROM campaigns WHERE id = ?`, [res.insertId]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error("create campaign error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
