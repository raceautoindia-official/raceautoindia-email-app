import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const [[overall]] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN subscribe = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN subscribe = 0 THEN 1 ELSE 0 END) AS inactive
      FROM emails
      WHERE deleted_at IS NULL
    `);

    const [perCat] = await db.query(`
      SELECT c.id, c.name, c.color,
        COUNT(DISTINCT e.id) AS total,
        SUM(CASE WHEN e.subscribe = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN e.subscribe = 0 THEN 1 ELSE 0 END) AS inactive
      FROM categories c
      LEFT JOIN email_categories ec ON ec.category_id = c.id
      LEFT JOIN emails e ON e.id = ec.email_id AND e.deleted_at IS NULL
      WHERE c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.color
      ORDER BY c.position ASC, c.id ASC
    `);

    const [[uncat]] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN subscribe = 1 THEN 1 ELSE 0 END) AS active
      FROM emails e
      WHERE deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM email_categories ec WHERE ec.email_id = e.id)
    `);

    const [[supp]] = await db.query(`SELECT COUNT(*) AS total FROM email_suppressions`);

    return NextResponse.json({
      overall: {
        total: Number(overall.total) || 0,
        active: Number(overall.active) || 0,
        inactive: Number(overall.inactive) || 0,
      },
      categories: perCat.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        total: Number(r.total) || 0,
        active: Number(r.active) || 0,
        inactive: Number(r.inactive) || 0,
      })),
      uncategorized: {
        total: Number(uncat.total) || 0,
        active: Number(uncat.active) || 0,
      },
      suppressions: Number(supp.total) || 0,
    });
  } catch (err) {
    console.error("stats error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
