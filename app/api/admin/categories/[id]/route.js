import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_request, context) {
  const { params } = await context;
  const id = parseInt(params.id, 10);
  const [rows] = await db.execute(
    `SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(request, context) {
  const { params } = await context;
  const id = parseInt(params.id, 10);
  const { name, slug, is_active, description, color } = await request.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  await db.execute(
    `UPDATE categories
     SET name = ?, slug = ?, is_active = ?, description = ?, color = COALESCE(?, color)
     WHERE id = ?`,
    [name, slug, is_active ? 1 : 0, description || null, color || null, id]
  );
  const [rows] = await db.execute(`SELECT * FROM categories WHERE id = ?`, [id]);
  return NextResponse.json(rows[0]);
}

// Soft delete: set deleted_at. The join table CASCADEs only on hard delete,
// so we explicitly clear the links here too.
export async function DELETE(_request, context) {
  const { params } = await context;
  const id = parseInt(params.id, 10);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`DELETE FROM email_categories WHERE category_id = ?`, [id]);
    await conn.execute(
      `UPDATE categories SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return new NextResponse(null, { status: 204 });
}
