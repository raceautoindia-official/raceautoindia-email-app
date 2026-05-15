// Deliverability helpers — shared between the send API and the UI.

export const BAD_FROM_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "mail.ru",
  "qq.com",
]);

export function senderDomainOf(email) {
  return String(email || "").split("@")[1]?.toLowerCase() || "";
}

export function isFreeMailFromDomain(email) {
  return BAD_FROM_DOMAINS.has(senderDomainOf(email));
}

// Subject-line spam-trigger heuristics. Returns an array of warning strings.
const SPAM_PATTERNS = [
  { re: /\bfree\b/i, msg: "contains the word 'free'" },
  { re: /\$\$\$|₹{2,}/i, msg: "contains repeated currency symbols" },
  { re: /!{2,}/, msg: "contains repeated exclamation marks" },
  { re: /\?{2,}/, msg: "contains repeated question marks" },
  { re: /\b(act now|urgent|limited time|hurry|expires today|click here|buy now)\b/i, msg: "contains an aggressive call-to-action phrase" },
  { re: /\b(winner|congratulations|you have won|you've won|prize)\b/i, msg: "contains a prize / winner phrase" },
  { re: /100%\s*(free|guarantee|guaranteed)/i, msg: "contains '100% free/guaranteed'" },
  { re: /\b(viagra|cialis|casino|crypto|bitcoin|forex)\b/i, msg: "contains a high-risk keyword" },
];

export function subjectWarnings(subject) {
  const warnings = [];
  const s = String(subject || "");
  if (!s.trim()) return warnings;
  if (s.length > 140) warnings.push("subject is very long (>140 chars)");
  // ALL CAPS heuristic — more than 60% uppercase letters and at least 8 letters.
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 8) {
    const upper = letters.replace(/[^A-Z]/g, "").length;
    if (upper / letters.length > 0.6) warnings.push("subject is mostly upper-case");
  }
  for (const { re, msg } of SPAM_PATTERNS) if (re.test(s)) warnings.push(`subject ${msg}`);
  return warnings;
}

// HTML body validation. Returns { errors, warnings }.
//
// `errors` block sending (hard requirements); `warnings` are advisory.
export function bodyValidation(html, { requireAddress = false, addressLine = "" } = {}) {
  const errors = [];
  const warnings = [];
  const h = String(html || "");

  if (!h.includes("{{unsubscribe_link}}")) {
    errors.push("Body must contain {{unsubscribe_link}} — required for compliance.");
  }

  if (requireAddress) {
    const addr = String(addressLine || "").trim();
    if (!addr) {
      warnings.push("Postal address not configured — set one in Settings → Compliance.");
    } else {
      // Very lenient containment: any non-empty token from the address line
      // appearing in the body counts.
      const first = addr.split(/[,\n]/)[0].trim().toLowerCase();
      if (first && !h.toLowerCase().includes(first)) {
        errors.push(`Body should include your postal address ("${first}…") for CAN-SPAM compliance.`);
      }
    }
  }

  const textLen = h.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().length;
  const imgCount = (h.match(/<img\b/gi) || []).length;
  if (textLen < 100 && imgCount > 0) {
    warnings.push("Very little visible text relative to images — image-heavy emails are more likely to be flagged as spam.");
  }
  if (/bit\.ly|tinyurl\.com|t\.co|goo\.gl/i.test(h)) {
    warnings.push("Body contains a URL shortener; spam filters distrust these.");
  }

  return { errors, warnings };
}
