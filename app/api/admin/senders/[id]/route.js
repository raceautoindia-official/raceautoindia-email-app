import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function PATCH(req, context) {
  const { params } = await context;
  const id = Number(params.id);
  const body = await req.json();

  const fields = [];
  const vals = [];
  for (const k of ["display_name", "reply_to", "is_active", "notes"]) {
    if (k in body) {
      fields.push(`${k} = ?`);
      vals.push(body[k] ?? null);
    }
  }
  if (body.set_default) {
    // promote to default; demote others atomically
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute(`UPDATE email_senders SET is_default = 0`);
      await conn.execute(`UPDATE email_senders SET is_default = 1 WHERE id = ?`, [id]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
  if (fields.length) {
    vals.push(id);
    await db.execute(`UPDATE email_senders SET ${fields.join(", ")} WHERE id = ?`, vals);
  }
  const [rows] = await db.execute(`SELECT * FROM email_senders WHERE id = ?`, [id]);
  return NextResponse.json(rows[0]);
}

export async function DELETE(_req, context) {
  const { params } = await context;
  const id = Number(params.id);
  // Soft-deactivate; never hard-delete because jobs may reference it.
  await db.execute(`UPDATE email_senders SET is_active = 0, is_default = 0 WHERE id = ?`, [id]);
  return new NextResponse(null, { status: 204 });
}
