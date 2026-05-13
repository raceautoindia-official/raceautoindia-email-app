import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requestEmailVerification, requestDomainVerification, checkSesVerification } from "@/lib/senders";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

// Body: { id?, target?, kind: "email" | "domain" }
//   - If id is given, looks up the sender row and uses its email/domain.
//   - If target is given, uses that directly.
//   - kind defaults to "email"; pass "domain" to register the whole domain.
export async function POST(req) {
  try {
    const body = await req.json();
    const kind = body.kind || "email";
    let target = body.target;

    if (!target && body.id) {
      const [[s]] = await db.query(`SELECT email FROM email_senders WHERE id = ?`, [Number(body.id)]);
      if (!s) return NextResponse.json({ error: "Sender not found" }, { status: 404 });
      target = kind === "domain" ? s.email.split("@")[1] : s.email;
    }

    if (!target) return NextResponse.json({ error: "Missing target" }, { status: 400 });

    if (kind === "email") {
      if (!EMAIL_RE.test(target)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      const out = await requestEmailVerification(target);
      // Re-check status so we can update the DB
      try {
        const v = await checkSesVerification(target);
        if (body.id) {
          await db.execute(
            `UPDATE email_senders SET ses_verified = ?, ses_verified_at = ? WHERE id = ?`,
            [v.verified ? 1 : 0, v.verified ? new Date() : null, Number(body.id)]
          );
        }
        return NextResponse.json({ ...out, status: v.status });
      } catch {
        return NextResponse.json(out);
      }
    }

    if (kind === "domain") {
      if (!DOMAIN_RE.test(target)) return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
      const out = await requestDomainVerification(target);
      return NextResponse.json(out);
    }

    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  } catch (err) {
    console.error("request-verification error", err);
    return NextResponse.json(
      { error: err.message || "SES request failed" },
      { status: 500 }
    );
  }
}
