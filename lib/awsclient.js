import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { convert } from "html-to-text";

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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

/**
 * Low-level: send a single email with retry/backoff.
 * Returns { messageId } on success, throws on terminal failure.
 */
export async function sendOne({ to, subject, html, plain, configurationSet, senderName, senderEmail, replyTo }) {
  const fromEmail = senderEmail || process.env.SENDER_EMAIL;
  const fromName = senderName || "Race Auto India";
  const reply = replyTo || fromEmail;
  const params = {
    Source: `"${fromName}" <${fromEmail}>`,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: html, Charset: "UTF-8" },
        Text: { Data: plain || convert(html, { wordwrap: 130 }), Charset: "UTF-8" },
      },
    },
    ConfigurationSetName: configurationSet || process.env.SES_CONFIGURATION_SET || "EmailTrackingSet",
    ReplyToAddresses: [reply],
    Headers: {
      "List-Unsubscribe": `<mailto:${fromEmail}>`,
    },
  };

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await sesClient.send(new SendEmailCommand(params));
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
