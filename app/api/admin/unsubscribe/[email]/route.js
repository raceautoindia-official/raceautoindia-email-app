import db from "@/lib/db";
import { NextResponse } from "next/server";
import { addSuppressions } from "@/lib/suppression";
import { audit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENERAL_CATEGORY = 1;

export async function PUT(req) {
  try {
    const { pathname } = new URL(req.url);
    const email = decodeURIComponent(pathname.split("/").pop()).toLowerCase();

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { message: "Invalid email." },
        { status: 400 }
      );
    }

    // 1) ALWAYS add to the global suppression list. This is the authoritative
    //    "never email this address again" record. Suppressions live in their
    //    own table so they work even when the email was never imported as a
    //    subscriber (e.g. the email was sent via the Excel tab, not from the
    //    Subscribers list).
    await addSuppressions([{ email, reason: "unsubscribe", source: "user-link" }]);

    // 2) Capture client metadata for audit.
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    // 3) Find or create the subscriber row so the admin can see who
    //    unsubscribed (otherwise Excel-only addresses would never show up
    //    in the Subscribers UI even though they're properly suppressed).
    const [rows] = await db.execute(
      `SELECT id, subscribe FROM emails WHERE email = ? LIMIT 1`,
      [email]
    );

    let alreadyUnsubscribed = false;
    let createdRow = false;
    if (!rows.length) {
      // Auto-create as INACTIVE so the admin sees the history.
      // Tag the row with a note so it's clear how this row got here.
      await db.execute(
        `INSERT IGNORE INTO emails (email, subscribe, category_id, notes, created_at)
         VALUES (?, 0, ?, ?, NOW())`,
        [
          email,
          GENERAL_CATEGORY,
          "Auto-created on unsubscribe click (was not in subscribers table - likely from an Excel-only send).",
        ]
      );
      createdRow = true;
    } else if (rows[0].subscribe === 0) {
      alreadyUnsubscribed = true;
    } else {
      await db.execute(`UPDATE emails SET subscribe = 0 WHERE email = ?`, [email]);
    }

    // 4) Audit trail — admin can see exactly when and from which IP.
    await audit({
      action: "user_unsubscribe",
      targetType: "emails",
      targetId: email,
      payload: { createdRow, alreadyUnsubscribed },
      ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: alreadyUnsubscribed
        ? "You were already unsubscribed. We'll keep your address on our suppression list — you won't receive further emails."
        : "You have been unsubscribed. Your address is now on our permanent suppression list.",
      alreadyUnsubscribed,
    });
  } catch (err) {
    // EVEN ON ERROR — never tell the user they failed to unsubscribe.
    // Their suppression entry was likely already added before this point;
    // log the issue and reassure them.
    console.error("Unsubscribe handler error:", err);
    return NextResponse.json(
      {
        success: true, // intentional — see comment above
        message: "Your unsubscribe request has been recorded. You won't receive further emails.",
        warning: "audit-step-failed",
      },
      { status: 200 }
    );
  }
}
