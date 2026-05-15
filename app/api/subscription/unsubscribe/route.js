import { NextResponse } from "next/server";
import db from "@/lib/db";
import { addSuppressions } from "@/lib/suppression";
import { audit } from "@/lib/audit";
import { verifyUnsubToken } from "@/lib/unsubToken";

// RFC 8058 one-click unsubscribe endpoint.
// Gmail / Yahoo / Outlook POST here with no user interaction when the user
// clicks "Unsubscribe" next to the sender name. They send the body
// `List-Unsubscribe=One-Click` as application/x-www-form-urlencoded.
//
// We *must* return 2xx within a short timeout. We do not require interactive
// confirmation per the RFC.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERAL_CATEGORY = 1;

async function doUnsubscribe(email, source, req) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  await addSuppressions([{ email, reason: "unsubscribe", source }]);

  const [rows] = await db.execute(
    `SELECT id, subscribe FROM emails WHERE email = ? LIMIT 1`,
    [email]
  );
  let alreadyUnsubscribed = false;
  let createdRow = false;
  if (!rows.length) {
    await db.execute(
      `INSERT IGNORE INTO emails (email, subscribe, category_id, notes, created_at)
       VALUES (?, 0, ?, ?, NOW())`,
      [
        email,
        GENERAL_CATEGORY,
        `Auto-created on ${source} unsubscribe.`,
      ]
    );
    createdRow = true;
  } else if (rows[0].subscribe === 0) {
    alreadyUnsubscribed = true;
  } else {
    await db.execute(`UPDATE emails SET subscribe = 0 WHERE email = ?`, [email]);
  }

  await audit({
    action: source === "one-click" ? "user_unsubscribe_one_click" : "user_unsubscribe",
    targetType: "emails",
    targetId: email,
    payload: { createdRow, alreadyUnsubscribed },
    ip,
    userAgent,
  });

  return { alreadyUnsubscribed, createdRow };
}

function getEmailFromQuery(url) {
  const u = new URL(url);
  const email = (u.searchParams.get("email") || "").trim().toLowerCase();
  const token = u.searchParams.get("t") || "";
  return { email, token };
}

export async function POST(req) {
  try {
    const { email, token } = getEmailFromQuery(req.url);
    if (!email || !EMAIL_RE.test(email)) {
      // Still return 2xx — mail clients retry on errors and we don't want loops.
      return NextResponse.json({ ok: true, ignored: "invalid-email" }, { status: 200 });
    }
    const verified = verifyUnsubToken(token, email);
    if (!verified.ok) {
      // Bad token: refuse silently with 200 so mail clients don't retry.
      console.warn("one-click unsub bad token:", verified.reason, email);
      return NextResponse.json({ ok: true, ignored: "bad-token" }, { status: 200 });
    }
    await doUnsubscribe(email, "one-click", req);
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error("one-click unsub error:", err);
    // Still 200 — never let mail clients retry indefinitely.
    return new NextResponse(null, { status: 200 });
  }
}

// Optional: support a GET that redirects users to the human confirmation page,
// so this URL works whether invoked by a mail client (POST) or pasted in a
// browser (GET).
export async function GET(req) {
  const { email, token } = getEmailFromQuery(req.url);
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (token) params.set("t", token);
  const dest = `/subscription/unsubscribe?${params.toString()}`;
  return NextResponse.redirect(new URL(dest, req.url));
}
