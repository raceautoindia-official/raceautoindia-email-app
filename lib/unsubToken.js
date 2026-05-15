import crypto from "crypto";

// Signed unsubscribe tokens so List-Unsubscribe URLs can't be forged.
// Token format: <b64url(payload)>.<b64url(hmac-sha256)>
// Payload: "<email>:<expiry-unix-seconds>"
//
// SECRET source: UNSUB_SECRET env var, falling back to APP_SECRET, with a
// last-resort warning if neither is set. In production both should be set.

const DEFAULT_TTL_DAYS = 365;

function getSecret() {
  const s = process.env.UNSUB_SECRET || process.env.APP_SECRET;
  if (!s) {
    // We still produce tokens so the app keeps working in dev, but warn loudly.
    if (!global.__unsubSecretWarned) {
      global.__unsubSecretWarned = true;
      console.warn(
        "⚠ UNSUB_SECRET not set — unsubscribe tokens use a weak fallback. Set UNSUB_SECRET in production."
      );
    }
    return "maildeck-insecure-fallback";
  }
  return s;
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s) {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return Buffer.from(
    s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad),
    "base64"
  );
}

export function makeUnsubToken(email, ttlDays = DEFAULT_TTL_DAYS) {
  const normalized = String(email || "").trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
  const payload = `${normalized}:${exp}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest();
  return `${b64url(payload)}.${b64url(sig)}`;
}

export function verifyUnsubToken(token, expectedEmail = null) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "malformed" };
  }
  const [payloadEnc, sigEnc] = token.split(".", 2);
  let payload;
  try {
    payload = fromB64url(payloadEnc).toString("utf-8");
  } catch {
    return { ok: false, reason: "decode" };
  }
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest();
  let providedSig;
  try {
    providedSig = fromB64url(sigEnc);
  } catch {
    return { ok: false, reason: "decode-sig" };
  }
  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(providedSig, expectedSig)
  ) {
    return { ok: false, reason: "signature" };
  }
  const [email, expStr] = payload.split(":");
  const exp = Number(expStr);
  if (!email || !exp || isNaN(exp)) return { ok: false, reason: "payload" };
  if (Date.now() / 1000 > exp) return { ok: false, reason: "expired" };
  if (expectedEmail && expectedEmail.toLowerCase() !== email) {
    return { ok: false, reason: "email-mismatch" };
  }
  return { ok: true, email };
}
