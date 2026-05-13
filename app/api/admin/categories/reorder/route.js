import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { order } = await req.json();
    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "Expected { order: [{id, position}, ...] }" }, { status: 400 });
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of order) {
        const id = Number(item?.id);
        const pos = Number(item?.position);
        if (!id) continue;
        await conn.execute(
          `UPDATE categories SET position = ? WHERE id = ?`,
          [pos, id]
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("reorder error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
