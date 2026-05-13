import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 100));
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const action = searchParams.get("action");

  const where = [];
  const params = [];
  if (action) { where.push("action = ?"); params.push(action); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT id, actor, action, target_type, target_id, payload, ip, created_at
     FROM audit_log ${whereSql}
     ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM audit_log ${whereSql}`,
    params
  );
  return NextResponse.json({ rows, total });
}
