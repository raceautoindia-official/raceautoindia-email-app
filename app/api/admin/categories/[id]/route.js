import db from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET(request, context) {
   const { params } = await context;
  const id = parseInt(params.id, 10);
  const [rows] = await db.execute(
    'SELECT * FROM categories WHERE id = ?',
    [id]
  )
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(rows[0])
}

/**
 * PUT /api/categories/:id
 */
export async function PUT(request, context) {
  const { params } = context;
  const id = parseInt(params.id, 10);

  const { name, slug, is_active, description } = await request.json();
  await db.execute(
    `UPDATE categories
        SET name = ?, slug = ?, is_active = ?, description = ?
      WHERE id = ?`,
    [name, slug, is_active ? 1 : 0, description, id]
  );

  const [rows] = await db.execute(
    "SELECT * FROM categories WHERE id = ?",
    [id]
  );
  return NextResponse.json(rows[0]);
}

/**
 * DELETE /api/categories/:id
 */
export async function DELETE(request, context) {
  // await the context to get params
  const { params } = await context;
  const id = parseInt(params.id, 10);

  await db.execute(
    "DELETE FROM categories WHERE id = ?",
    [id]
  );

  return new NextResponse(null, { status: 204 });
}
