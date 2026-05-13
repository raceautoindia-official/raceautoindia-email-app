import { NextResponse } from "next/server";
import db from "@/lib/db";
import { listSenders, checkSesVerification, listVerifiedSesIdentities } from "@/lib/senders";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const withSes = searchParams.get("with_ses") === "1";
  const rows = await listSenders();
  let sesIdentities = null;
  if (withSes) sesIdentities = await listVerifiedSesIdentities();
  return NextResponse.json({ rows, sesIdentities });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const display_name = String(body.display_name || "").trim();
    const reply_to = body.reply_to ? String(body.reply_to).trim() : null;
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!display_name) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    // Check SES verification status BEFORE storing — flag in DB.
    let verified = false;
    try {
      const v = await checkSesVerification(email);
      verified = v.verified;
    } catch (_) {}

    try {
      const [res] = await db.execute(
        `INSERT INTO email_senders (email, display_name, reply_to, is_default, ses_verified, ses_verified_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
        [email, display_name, reply_to, verified ? 1 : 0, verified ? new Date() : null]
      );
      const [rows] = await db.execute(`SELECT * FROM email_senders WHERE id = ?`, [res.insertId]);
      return NextResponse.json(rows[0], { status: 201 });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return NextResponse.json({ error: "Sender already exists" }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    console.error("create sender error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
