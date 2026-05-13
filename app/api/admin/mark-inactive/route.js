import db from "@/lib/db";
import { NextResponse } from "next/server";
import { addSuppressions } from "@/lib/suppression";
import { audit } from "@/lib/audit";

export async function POST(req) {
  try {
    const body = await req.json();
    let emails = Array.isArray(body.emails) ? body.emails : null;
    const fromDate = body.from;
    const toDate = body.to;
    const status = body.status || "Bounce";
    const suppress = body.suppress !== false; // default: also add to suppression list

    // Server-side bulk: resolve emails from date+status filter (no client list needed).
    if (!emails && fromDate && toDate) {
      const [rows] = await db.query(
        `SELECT DISTINCT email FROM email_events
         WHERE eventTime >= ? AND eventTime < DATE_ADD(?, INTERVAL 1 DAY)
           AND status = ?`,
        [fromDate, toDate, status]
      );
      emails = rows.map((r) => r.email);
    }

    if (!Array.isArray(emails) || !emails.length) {
      return NextResponse.json(
        { success: false, message: "No emails to mark." },
        { status: 400 }
      );
    }

    const ph = emails.map(() => "?").join(",");
    const [res] = await db.execute(
      `UPDATE emails SET subscribe = 0 WHERE email IN (${ph})`,
      emails
    );

    let suppressedAdded = 0;
    if (suppress) {
      suppressedAdded = await addSuppressions(
        emails.map((email) => ({
          email,
          reason: status === "Complaint" ? "complaint" : "bounce",
          source: "mark-inactive",
        }))
      );
    }

    await audit({
      action: "mark_inactive",
      targetType: "emails",
      payload: { count: emails.length, status, suppressedAdded },
    });

    return NextResponse.json({
      success: true,
      message: `Marked ${res.affectedRows} email(s) as unsubscribed.`,
      affected: res.affectedRows,
      suppressedAdded,
    });
  } catch (err) {
    console.error("Bulk unsubscribe error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to update subscription status." },
      { status: 500 }
    );
  }
}
