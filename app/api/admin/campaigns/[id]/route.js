import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(_req, context) {
  const { params } = await context;
  const id = Number(params.id);
  const [rows] = await db.execute(`SELECT * FROM campaigns WHERE id = ?`, [id]);
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(req, context) {
  const { params } = await context;
  const id = Number(params.id);
  const body = await req.json();
  const name = body?.name?.toString().trim();
  const subject = body?.subject?.toString().trim();
  const html_body = body?.html_body?.toString() ?? null;
  const category_id = body?.category_id != null ? Number(body.category_id) : null;
  if (!name || !subject) return NextResponse.json({ error: "name and subject required" }, { status: 400 });
  await db.execute(
    `UPDATE campaigns SET name = ?, subject = ?, html_body = ?, category_id = ? WHERE id = ?`,
    [name, subject, html_body, category_id, id]
  );
  const [rows] = await db.execute(`SELECT * FROM campaigns WHERE id = ?`, [id]);
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req, context) {
  const { params } = await context;
  const id = Number(params.id);
  // Don't cascade-delete jobs; just clear the link.
  await db.execute(`UPDATE email_jobs SET campaign_id = NULL WHERE campaign_id = ?`, [id]);
  await db.execute(`DELETE FROM campaigns WHERE id = ?`, [id]);
  return new NextResponse(null, { status: 204 });
}
