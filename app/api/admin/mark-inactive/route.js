// File: /app/api/admin/mark-inactive/route.js (or .ts if using TypeScript)

import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const body = await req.json();
    const emails = body.emails;

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { success: false, message: "No emails provided." },
        { status: 400 }
      );
    }

    // Update all given emails to subscribe = 0
    const placeholders = emails.map(() => "?").join(",");
    const query = `UPDATE emails SET subscribe = 0 WHERE email IN (${placeholders})`;

    const [result] = await db.execute(query, emails);

    return NextResponse.json({
      success: true,
      message: `Marked ${result.affectedRows} email(s) as unsubscribed.`,
    });
  } catch (err) {
    console.error("Bulk unsubscribe error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to update subscription status." },
      { status: 500 }
    );
  }
}
