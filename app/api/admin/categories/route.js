import db from "@/lib/db";
import { NextResponse } from "next/server";

const PALETTE = [
  "#0d6efd", "#6610f2", "#6f42c1", "#d63384", "#dc3545",
  "#fd7e14", "#ffc107", "#198754", "#20c997", "#0dcaf0",
];

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const withCounts = searchParams.get("with_counts") === "1";

  if (withCounts) {
    const [rows] = await db.query(`
      SELECT c.id, c.name, c.slug, c.is_active, c.description, c.color, c.position,
             c.created_at, c.updated_at,
             COALESCE(stats.total, 0)    AS total,
             COALESCE(stats.active, 0)   AS active,
             COALESCE(stats.inactive, 0) AS inactive
      FROM categories c
      LEFT JOIN (
        SELECT ec.category_id,
               COUNT(*) AS total,
               SUM(CASE WHEN e.subscribe = 1 THEN 1 ELSE 0 END) AS active,
               SUM(CASE WHEN e.subscribe = 0 THEN 1 ELSE 0 END) AS inactive
        FROM email_categories ec
        INNER JOIN emails e ON e.id = ec.email_id AND e.deleted_at IS NULL
        GROUP BY ec.category_id
      ) stats ON stats.category_id = c.id
      WHERE c.deleted_at IS NULL
      ORDER BY c.position ASC, c.id ASC
    `);
    return NextResponse.json(rows);
  }

  const [rows] = await db.query(
    `SELECT id, name, slug, is_active, description, color, position
     FROM categories
     WHERE deleted_at IS NULL
     ORDER BY position ASC, id ASC`
  );
  return NextResponse.json(rows);
}

export async function POST(request) {
  const body = await request.json();
  let { name, slug, is_active = true, description, color } = body;
  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  name = String(name).trim();
  if (!slug) slug = slugify(name);
  if (!color) {
    const [[{ cnt }]] = await db.query(`SELECT COUNT(*) AS cnt FROM categories WHERE deleted_at IS NULL`);
    color = PALETTE[cnt % PALETTE.length];
  }
  const [[{ pos }]] = await db.query(
    `SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM categories WHERE deleted_at IS NULL`
  );

  try {
    const [result] = await db.execute(
      `INSERT INTO categories (name, slug, is_active, description, color, position)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, slug, is_active ? 1 : 0, description || null, color, pos]
    );
    const [newRows] = await db.execute(`SELECT * FROM categories WHERE id = ?`, [result.insertId]);
    return NextResponse.json(newRows[0], { status: 201 });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "A category with that name or slug already exists" }, { status: 409 });
    }
    throw err;
  }
}
