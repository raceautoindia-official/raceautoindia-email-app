import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { convert } from "html-to-text";
import { buildRawMime, formatFromAddress } from "./mimeBuilder";
import { makeUnsubToken } from "./unsubToken";

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || "https://newsletter.raceautoindia.com";

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const RETRYABLE = new Set([
  "Throttling",
  "ThrottlingException",
  "MaxSendingRateExceeded",
  "ServiceUnavailable",
  "TooManyRequestsException",
]);

function listIdFromBaseUrl(baseUrl) {
  // List-Id needs a domain-style identifier inside angle brackets.
  try {
    const u = new URL(baseUrl);
    return `<newsletter.${u.hostname}>`;
  } catch {
    return "<newsletter.raceautoindia.com>";
  }
}

function buildUnsubscribeHeaders({ to, fromEmail, listId, refId }) {
  const token = makeUnsubToken(to);
  const enc = encodeURIComponent(to);
  const httpUrl = `${PUBLIC_BASE_URL}/api/subscription/unsubscribe?email=${enc}&t=${token}`;
  const mailto = `mailto:${fromEmail}?subject=unsubscribe`;
  const headers = {
    "List-Unsubscribe": `<${httpUrl}>, <${mailto}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "List-Id": listId,
    Precedence: "bulk",
    "Auto-Submitted": "auto-generated",
  };
  if (refId) headers["X-Entity-Ref-ID"] = refId;
  return { headers, httpUrl };
}

/**
 * Low-level: send a single email with retry/backoff.
 * Returns { messageId } on success, throws on terminal failure.
 *
 * The HTML body should already have merge tags (e.g. {{unsubscribe_link}})
 * substituted by the caller — we only set the *headers* here.
 */
export async function sendOne({
  to,
  subject,
  html,
  plain,
  configurationSet,
  senderName,
  senderEmail,
  replyTo,
  jobId,
  recipientId,
}) {
  const fromEmail = senderEmail || process.env.SENDER_EMAIL;
  const fromName = senderName || "Race Auto India";
  const reply = replyTo || fromEmail;
  const listId = listIdFromBaseUrl(PUBLIC_BASE_URL);
  const refId =
    jobId != null && recipientId != null
      ? `${jobId}:${recipientId}`
      : jobId != null
      ? String(jobId)
      : null;

  const { headers: unsubHeaders } = buildUnsubscribeHeaders({
    to,
    fromEmail,
    listId,
    refId,
  });

  const rawBody = buildRawMime({
    from: formatFromAddress(fromName, fromEmail),
    to,
    subject,
    html,
    text: plain || convert(html || "", { wordwrap: 130 }),
    replyTo: reply,
    headers: unsubHeaders,
  });

  const params = {
    Source: `"${fromName}" <${fromEmail}>`,
    Destinations: [to],
    RawMessage: { Data: rawBody },
    ConfigurationSetName:
      configurationSet || process.env.SES_CONFIGURATION_SET || "EmailTrackingSet",
  };

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await sesClient.send(new SendRawEmailCommand(params));
      return { messageId: res.MessageId };
    } catch (err) {
      lastErr = err;
      const code = err.name || err.Code;
      if (!RETRYABLE.has(code) || attempt === 3) break;
      const backoff = 200 * Math.pow(2, attempt) + Math.random() * 200;
      await delay(backoff);
    }
  }
  throw lastErr;
}

/**
 * Legacy helper kept for backwards compatibility.
 * Sends a single recipient at a time, throttled by rateLimit.
 */
export async function sendBulkEmails(recipients, subject, message, opts = {}) {
  const { rateLimit = 10 } = opts;
  const results = [];
  const plain = convert(message, { wordwrap: 130 });
  const pauseMs = rateLimit > 0 ? 1000 / rateLimit : 0;

  for (let i = 0; i < recipients.length; i++) {
    const to = recipients[i];
    try {
      const { messageId } = await sendOne({
        to,
        subject,
        html: message,
        plain,
      });
      results.push({ success: { MessageId: messageId } });
    } catch (err) {
      results.push({ error: err });
    }
    if (pauseMs > 0 && i < recipients.length - 1) await delay(pauseMs);
  }
  return results;
}
