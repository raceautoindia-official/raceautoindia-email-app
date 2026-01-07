import { sendBulkEmails } from "@/lib/awsclient";
import { NextResponse } from "next/server";
import db from "@/lib/db"; // adjust path if needed

export async function POST(req) {
  try {
    const body = await req.json();
    const { subject, message, rateLimit } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { success: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    // ✅ Fetch recipients from MySQL
    const [rows] = await db.query(
      "SELECT email FROM emails WHERE subscribe != 0"
    );
    const recipients = rows.map((row) => row.email);

    const finalRecipients = [];
    recipients.forEach((email, index) => {
      finalRecipients.push(email);
      if ((index + 1) % 1000 === 0) {
        finalRecipients.push("arunpandian972000@gmail.com");
      }
    });

    // ✅ Send to all final recipients
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

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Bulk send failed", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
