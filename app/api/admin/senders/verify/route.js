import { NextResponse } from "next/server";
import db from "@/lib/db";
import { checkSesVerification } from "@/lib/senders";

export async function POST(req) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const [rows] = await db.execute(`SELECT * FROM email_senders WHERE id = ?`, [Number(id)]);
    const s = rows[0];
    if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const v = await checkSesVerification(s.email);
    await db.execute(
      `UPDATE email_senders SET ses_verified = ?, ses_verified_at = ? WHERE id = ?`,
      [v.verified ? 1 : 0, v.verified ? new Date() : null, s.id]
    );
    return NextResponse.json({ ...v, sender_id: s.id });
  } catch (err) {
    console.error("verify error", err);
    return NextResponse.json({ error: err.message || "Internal" }, { status: 500 });
  }
}
