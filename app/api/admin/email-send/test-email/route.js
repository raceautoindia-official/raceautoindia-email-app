import { sendBulkEmails } from "@/lib/awsclient";
import { NextResponse } from "next/server";

// import db from "@/lib/db"; // COMMENTED OUT FOR TESTING

export async function POST(req) {
  try {
    const body = await req.json();
    const { recipient, subject, message } = body;

    if (!recipient || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Subject and message are required." },
        { status: 400 }
      );
    }
    const recipients =[recipient]

    const encoded = encodeURIComponent(recipient);
      const html = message
        .replace(
          "{{unsubscribe_link}}",
          `https://newsletter.raceautoindia.com/subscription/unsubscribe?email=${encoded}`
        )
        .replace("{{visible_email}}", recipient);

    const result = await sendBulkEmails(recipients, subject, html);

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (err) {
    console.error("Email sending error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
