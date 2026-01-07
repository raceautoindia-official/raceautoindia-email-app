import { NextResponse } from "next/server";
import https from "https";
import db from "@/lib/db";

async function parseBody(req) {
  const reader = req.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Priority of statuses from lowest to highest
const statusRank = {
  Delivery: 1,
  Open: 2,
  Click: 3,
  Bounce: 4,
  Complaint: 5,
};

export async function POST(req) {
  try {
    const messageType = req.headers.get("x-amz-sns-message-type");
    const rawBody = await parseBody(req);

    if (messageType === "SubscriptionConfirmation") {
      const { SubscribeURL } = JSON.parse(rawBody);
      https.get(SubscribeURL, () => {
        console.log("✅ SNS subscription confirmed");
      });
      return NextResponse.json({ message: "Subscribed" });
    }

    if (messageType === "Notification") {
      const snsMessage = JSON.parse(JSON.parse(rawBody).Message);
      const eventType = snsMessage.eventType || snsMessage.notificationType || "unknown";
      const messageId = snsMessage.mail?.messageId || "unknown";
      const email = snsMessage.mail?.destination?.[0] || "unknown";
      const eventTime = snsMessage.mail?.timestamp || new Date().toISOString();

      let link = null;
      let ip = null;
      let userAgent = null;

      if (eventType === "Click") {
        link = snsMessage.click?.link || null;
        ip = snsMessage.click?.ipAddress || null;
        userAgent = snsMessage.click?.userAgent || null;
        console.log(`🔗 Click by ${email} on ${link}`);
      } else if (eventType === "Open") {
        ip = snsMessage.open?.ipAddress || null;
        userAgent = snsMessage.open?.userAgent || null;
        console.log(`👁️ Open by ${email}`);
      } else if (eventType === "Delivery") {
        console.log(`📬 Delivered to ${email} at ${eventTime}`);
      } else if (eventType === "Bounce") {
        console.log(`📛 Bounce for ${email}`);
      } else if (eventType === "Complaint") {
        console.log(`🛑 Complaint from ${email}`);
      } else {
        console.log(`ℹ️ Other event: ${eventType} for ${email}`);
      }

      // Fetch existing row (if any)
      const [rows] = await db.query(
        `SELECT status FROM email_events WHERE messageId = ?`,
        [messageId]
      );
      const existing = rows[0];

      const incomingRank = statusRank[eventType] ?? 0;
      const existingRank = statusRank[existing?.status] ?? 0;

      if (!existing) {
        // No record exists yet — insert
        await db.query(
          `INSERT INTO email_events (
            messageId, email, status, link, ip, userAgent, eventTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [messageId, email, eventType, link, ip, userAgent, new Date(eventTime)]
        );
        console.log(`✅ New status '${eventType}' recorded for ${email}`);
      } else if (incomingRank > existingRank) {
        // Incoming status is higher priority — update
        await db.query(
          `UPDATE email_events
           SET status = ?, link = ?, ip = ?, userAgent = ?, eventTime = ?
           WHERE messageId = ?`,
          [eventType, link, ip, userAgent, new Date(eventTime), messageId]
        );
        console.log(`🔁 Updated status to '${eventType}' for ${email}`);
      } else {
        console.log(`⏩ Skipped '${eventType}' for ${email} — current: '${existing.status}'`);
      }

      return NextResponse.json({ message: "Processed" });
    }

    return NextResponse.json({ message: "Ignored" });
  } catch (err) {
    console.error("❌ Error:", err.message);
    return NextResponse.json({ error: "Invalid SNS message" }, { status: 400 });
  }
}
