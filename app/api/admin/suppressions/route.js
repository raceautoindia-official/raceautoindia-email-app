import { NextResponse } from "next/server";
import db from "@/lib/db";
import { addSuppressions, removeSuppression } from "@/lib/suppression";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(500, Number(searchParams.get("limit")) || 50));
  const offset = (page - 1) * limit;
  const q = (searchParams.get("q") || "").trim();
  const reason = searchParams.get("reason");

  const where = [];
  const params = [];
  if (q) {
    where.push("email LIKE ?");
    params.push(`%${q}%`);
  }
  if (reason && reason !== "all") {
    where.push("reason = ?");
    params.push(reason);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT email, reason, source, notes, created_at
     FROM email_suppressions ${whereSql}
     ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  );
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM email_suppressions ${whereSql}`,
    params
  );
  return NextResponse.json({ rows, total, page, limit });
}

export async function POST(req) {
  const body = await req.json();
  const entries = Array.isArray(body?.entries) ? body.entries : [];
  const cleaned = entries
    .map((e) => ({
      email: String(e.email || "").trim().toLowerCase(),
      reason: e.reason || "manual",
      source: e.source || null,
      notes: e.notes || null,
    }))
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email));
  const added = await addSuppressions(cleaned);
  return NextResponse.json({ success: true, added });
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });
  const removed = await removeSuppression(email);
  return NextResponse.json({ success: true, removed });
}
