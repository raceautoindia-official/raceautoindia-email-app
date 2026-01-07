import { sendBulkEmails } from "@/lib/awsclient";
import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req) {
  try {
    const { subject, message, category_id, rateLimit } = await req.json();

    if (!subject || !message || !category_id) {
      return NextResponse.json(
        { success: false, error: "Missing subject, message or category_id" },
        { status: 400 }
      );
    }

    // 1) Fetch only subscribed emails in this category
    const [rows] = await db.query(
      "SELECT email FROM emails WHERE subscribe != 0 AND category_id = ?",
      [category_id]
    );
    const recipients = rows.map((r) => r.email);

    // 2) (Optional) intersperse your own address every 100 mails
    const finalRecipients = [];
    recipients.forEach((email, i) => {
      finalRecipients.push(email);
      if ((i + 1) % 100 === 0) {
        finalRecipients.push("ramkumarveeraiya@gmail.com");
      }
    });

    // 3) Send one‐by‐one (so your rateLimit applies per message)
    for (const email of finalRecipients) {
      const encoded = encodeURIComponent(email);
      const html = message
        .replace(
          "{{unsubscribe_link}}",
          `https://newsletter.raceautoindia.com/subscription/unsubscribe?email=${encoded}`
        )
        .replace("{{visible_email}}", email);

      await sendBulkEmails([email], subject, html, rateLimit);
    }

    return NextResponse.json({
      success: true,
      sentCount: recipients.length,
      totalWithChecks: finalRecipients.length,
    });
  } catch (err) {
    console.error("Category send failed", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
