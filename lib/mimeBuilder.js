import crypto from "crypto";

// Minimal RFC 5322 / 2045 MIME builder for SES SendRawEmail.
// Builds a multipart/alternative message with custom headers so we can set
// List-Unsubscribe, List-Unsubscribe-Post, List-Id, Precedence, etc.

const CRLF = "\r\n";

// Encodes a header value containing non-ASCII as RFC 2047 "encoded-word".
function encodeHeaderValue(v) {
  const s = String(v ?? "");
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
}

// Encodes "Display Name <addr@x>" properly.
function formatFromAddress(displayName, email) {
  const addr = `<${email}>`;
  if (!displayName) return email;
  // Quote the display name; encode if non-ASCII.
  // eslint-disable-next-line no-control-regex
  const safe = /^[\x20-\x7e]*$/.test(displayName);
  const name = safe ? `"${displayName.replace(/"/g, '\\"')}"` : encodeHeaderValue(displayName);
  return `${name} ${addr}`;
}

function quotedPrintable(text) {
  // Simple QP encoder for headers/bodies. For bodies we generally use base64,
  // but exposed here in case the caller wants QP. Not currently used.
  return text
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code === 0x20 || code === 0x09 || (code >= 0x21 && code <= 0x7e && ch !== "=")) {
        return ch;
      }
      if (ch === "\n" || ch === "\r") return ch;
      return "=" + code.toString(16).toUpperCase().padStart(2, "0");
    })
    .join("");
}

function base64Wrap(buf, width = 76) {
  const b64 = Buffer.from(buf, "utf-8").toString("base64");
  const lines = [];
  for (let i = 0; i < b64.length; i += width) lines.push(b64.slice(i, i + width));
  return lines.join(CRLF);
}

function genBoundary(prefix) {
  return `=_${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * Build a raw RFC 5322 MIME message body.
 *
 * @param {object} args
 * @param {string} args.from         Pre-formatted From header value (e.g. `"Name" <addr@x>`)
 * @param {string} args.to           Recipient address
 * @param {string} args.subject      Subject line (will be encoded if non-ASCII)
 * @param {string} args.html         HTML body
 * @param {string} args.text         Plain-text body
 * @param {string} [args.replyTo]    Reply-To header
 * @param {object} [args.headers]    Extra headers (key → string value).
 *                                   Values are passed through; caller is
 *                                   responsible for ASCII-safe content.
 * @returns {Buffer}
 */
export function buildRawMime({
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  headers = {},
}) {
  const altBoundary = genBoundary("alt");

  const baseHeaders = {
    "MIME-Version": "1.0",
    From: from,
    To: to,
    Subject: encodeHeaderValue(subject || ""),
    Date: new Date().toUTCString(),
    "Content-Type": `multipart/alternative; boundary="${altBoundary}"`,
  };
  if (replyTo) baseHeaders["Reply-To"] = replyTo;

  // Caller's extra headers override defaults if they collide (intentional).
  const merged = { ...baseHeaders, ...headers };

  const headerLines = Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join(CRLF);

  const textPart =
    `--${altBoundary}${CRLF}` +
    `Content-Type: text/plain; charset="UTF-8"${CRLF}` +
    `Content-Transfer-Encoding: base64${CRLF}${CRLF}` +
    `${base64Wrap(text ?? "")}${CRLF}`;

  const htmlPart =
    `--${altBoundary}${CRLF}` +
    `Content-Type: text/html; charset="UTF-8"${CRLF}` +
    `Content-Transfer-Encoding: base64${CRLF}${CRLF}` +
    `${base64Wrap(html ?? "")}${CRLF}`;

  const closing = `--${altBoundary}--${CRLF}`;

  const raw = `${headerLines}${CRLF}${CRLF}${textPart}${htmlPart}${closing}`;
  return Buffer.from(raw, "utf-8");
}

export { formatFromAddress, encodeHeaderValue, quotedPrintable };
