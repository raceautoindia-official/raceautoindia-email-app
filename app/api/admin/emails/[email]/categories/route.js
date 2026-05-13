import { NextResponse } from "next/server";
import db from "@/lib/db";
import { setCategoriesForEmail } from "@/lib/emailCategories";

async function getEmailRow(emailStr) {
  const [rows] = await db.execute(
    `SELECT id FROM emails WHERE email = ? LIMIT 1`,
    [emailStr]
  );
  return rows[0] || null;
}

export async function GET(req) {
  const { pathname } = new URL(req.url);
  const parts = pathname.split("/");
  const email = decodeURIComponent(parts[parts.length - 2]);
  const row = await getEmailRow(email);
  if (!row) return NextResponse.json({ error: "Email not found" }, { status: 404 });
  const [cats] = await db.query(
    `SELECT c.id, c.name, c.color
     FROM email_categories ec
     INNER JOIN categories c ON c.id = ec.category_id AND c.deleted_at IS NULL
     WHERE ec.email_id = ?
     ORDER BY c.position ASC, c.id ASC`,
    [row.id]
  );
  return NextResponse.json({ email, categories: cats });
}

// Replace the full set of categories for one email
export async function PUT(req) {
  try {
    const { pathname } = new URL(req.url);
    const parts = pathname.split("/");
    const email = decodeURIComponent(parts[parts.length - 2]);
    const body = await req.json();
    const ids = Array.isArray(body?.category_ids)
      ? body.category_ids.map(Number).filter(Boolean)
      : [];
    const row = await getEmailRow(email);
    if (!row) return NextResponse.json({ error: "Email not found" }, { status: 404 });
    await setCategoriesForEmail(row.id, ids);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("set categories error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
