import db from "@/lib/db";
import { NextResponse } from "next/server";

export async function PUT(req) {
  try {
    const { pathname } = new URL(req.url);
    const email = decodeURIComponent(pathname.split("/").pop());

    // Check if email exists
    const [rows] = await db.execute(
      `SELECT subscribe FROM emails WHERE email = ?`,
      [email]
    );

    if (!rows.length) {
      return NextResponse.json(
        { message: "Email does not exist." },
        { status: 404 }
      );
    }

    const subscriptionStatus = rows[0].subscribe;

    if (subscriptionStatus === 0) {
      return NextResponse.json(
        { message: "Email is already unsubscribed." },
        { status: 400 }
      );
    }

    // Update subscription to 0
    await db.execute(
      `UPDATE emails SET subscribe = 0 WHERE email = ?`,
      [email]
    );

    return NextResponse.json({ message: "Email unsubscribed successfully." });
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return NextResponse.json(
      { message: "Failed to update subscription status." },
      { status: 500 }
    );
  }
}
