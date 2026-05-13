import { NextResponse } from "next/server";
import https from "https";
import db from "@/lib/db";
import { addSuppressions } from "@/lib/suppression";
import { verifySnsMessage } from "@/lib/snsVerify";
import { upsertEmailEvent } from "@/lib/emailEvents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// Normalize SES event types to the values used in the DB / UI.
function normalizeEventType(t) {
  if (t === "Send") return "Sent";
  return t;
}

// Pick the event-specific timestamp. Falls back to mail.timestamp (send time)
// so a row always has something, but events that happen later (Open/Click) get
// their real timestamp.
function pickEventTime(eventType, snsMessage) {
  const sub = {
    Sent: snsMessage.send?.timestamp,
    Delivery: snsMessage.delivery?.timestamp,
    Open: snsMessage.open?.timestamp,
    Click: snsMessage.click?.timestamp,
    Bounce: snsMessage.bounce?.timestamp,
    Complaint: snsMessage.complaint?.timestamp,
  }[eventType];
  const raw = sub || snsMessage.mail?.timestamp || new Date().toISOString();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date() : d;
}

async function confirmSubscription(subscribeURL) {
  if (
    !subscribeURL ||
    !/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\/[^\s]*$/i.test(subscribeURL)
  ) {
    return false;
  }
  return new Promise((resolve) => {
    const req = https.get(subscribeURL, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode === 200));
      res.on("error", () => resolve(false));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(10_000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function syncLastEvent(email, status, eventTime) {
  try {
    await db.execute(
      `UPDATE emails
         SET last_event_status = ?, last_event_at = ?
       WHERE email = ?
         AND (last_event_at IS NULL OR last_event_at <= ?)`,
      [status, eventTime, email, eventTime]
    );
  } catch (err) {
    console.warn("syncLastEvent failed:", err.message);
  }
}

async function autoSuppress(email, eventType, snsMessage) {
  try {
    if (eventType === "Bounce") {
      const bounceType = snsMessage?.bounce?.bounceType;
      if (bounceType === "Permanent") {
        await addSuppressions([{ email, reason: "bounce", source: "ses-sns" }]);
        await db.execute(`UPDATE emails SET subscribe = 0 WHERE email = ?`, [email]);
      }
    } else if (eventType === "Complaint") {
      await addSuppressions([{ email, reason: "complaint", source: "ses-sns" }]);
      await db.execute(`UPDATE emails SET subscribe = 0 WHERE email = ?`, [email]);
    }
  } catch (err) {
    console.warn("autoSuppress failed:", err.message);
  }
}

export async function POST(req) {
  try {
    const messageType = req.headers.get("x-amz-sns-message-type");
    const rawBody = await parseBody(req);

    let outer;
    try {
      outer = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const verified = await verifySnsMessage(outer);
    if (!verified.ok) {
      console.warn("SNS signature rejected:", verified.error);
      return NextResponse.json({ error: "Signature invalid" }, { status: 403 });
    }

    if (messageType === "SubscriptionConfirmation" || messageType === "UnsubscribeConfirmation") {
      const ok = await confirmSubscription(outer.SubscribeURL);
      if (ok) {
        console.log("✅ SNS subscription confirmed");
        return NextResponse.json({ message: "Subscribed" });
      }
      return NextResponse.json({ error: "Invalid SubscribeURL" }, { status: 400 });
    }

    if (messageType !== "Notification") {
      return NextResponse.json({ message: "Ignored" });
    }

    let snsMessage;
    try {
      snsMessage = JSON.parse(outer.Message);
    } catch {
      return NextResponse.json({ error: "Invalid inner Message" }, { status: 400 });
    }

    const rawType = snsMessage.eventType || snsMessage.notificationType || "unknown";
    const eventType = normalizeEventType(rawType);
    const messageId = snsMessage.mail?.messageId || "unknown";
    const email =
      snsMessage.mail?.destination?.[0] ||
      snsMessage.bounce?.bouncedRecipients?.[0]?.emailAddress ||
      snsMessage.complaint?.complainedRecipients?.[0]?.emailAddress ||
      "unknown";
    const subject = snsMessage.mail?.commonHeaders?.subject || null;
    const eventTime = pickEventTime(eventType, snsMessage);

    let link = null;
    let ip = null;
    let userAgent = null;
    if (eventType === "Click") {
      link = snsMessage.click?.link || null;
      ip = snsMessage.click?.ipAddress || null;
      userAgent = snsMessage.click?.userAgent || null;
    } else if (eventType === "Open") {
      ip = snsMessage.open?.ipAddress || null;
      userAgent = snsMessage.open?.userAgent || null;
    }

    if (messageId !== "unknown") {
      await upsertEmailEvent({
        messageId,
        email,
        subject,
        status: eventType,
        link,
        ip,
        userAgent,
        eventTime,
      });
    }

    if (email && email !== "unknown") {
      await syncLastEvent(email, eventType, eventTime);
      await autoSuppress(email, eventType, snsMessage);
    }

    return NextResponse.json({ message: "Processed" });
  } catch (err) {
    console.error("❌ SNS error:", err);
    return NextResponse.json({ error: "Invalid SNS message" }, { status: 400 });
  }
}
