// app/api/admin/emails/[email]/route.js
import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(request) {
  try {
    // extract email from URL
    const { pathname } = new URL(request.url);
    const email = decodeURIComponent(pathname.split("/").pop());

    // read raw body
    const raw = await request.text();
    let body = {};
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        // ignore parse errors, treat as empty
        body = {};
      }
    }

    // if category_id provided, update that
    if (body.category_id !== undefined) {
      const catId = parseInt(body.category_id, 10) || 1;
      await db.execute(
        `UPDATE emails SET category_id = ? WHERE email = ?`,
        [catId, email]
      );
      return NextResponse.json(
        { message: "category updated", category_id: catId }
      );
    }

    // otherwise toggle subscribe
    await db.execute(
      `UPDATE emails SET subscribe = 1 - subscribe WHERE email = ?`,
      [email]
    );
    const [[row]] = await db.execute(
      `SELECT subscribe FROM emails WHERE email = ?`,
      [email]
    );
    return NextResponse.json(
      { message: "subscribe toggled", subscribe: row.subscribe }
    );
  } catch (err) {
    console.error("Toggle error:", err);
    return NextResponse.json(
      { message: "failed to update" },
      { status: 500 }
    );
  }
}
