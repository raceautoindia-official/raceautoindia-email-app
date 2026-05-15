import { sendOne } from "@/lib/awsclient";
import { NextResponse } from "next/server";
import { convert } from "html-to-text";
import { makeUnsubToken } from "@/lib/unsubToken";

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://newsletter.raceautoindia.com";

export async function POST(req) {
  try {
    const { recipient, subject, message } = await req.json();
    if (!recipient || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Recipient, subject and message are required." },
        { status: 400 }
      );
    }

    const enc = encodeURIComponent(recipient);
    const token = makeUnsubToken(recipient);
    const link = `${PUBLIC_BASE_URL}/subscription/unsubscribe?email=${enc}&t=${token}`;
    const html = (message || "")
      .replaceAll("{{unsubscribe_link}}", link)
      .replaceAll("{{visible_email}}", recipient);

    const result = await sendOne({
      to: recipient,
      subject,
      html,
      plain: convert(html, { wordwrap: 130 }),
    });

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error("Test email error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
