import db from "./db";
import {
  SESClient,
  GetIdentityVerificationAttributesCommand,
  ListVerifiedEmailAddressesCommand,
  VerifyEmailIdentityCommand,
  VerifyDomainIdentityCommand,
  VerifyDomainDkimCommand,
  GetSendQuotaCommand,
  GetAccountSendingEnabledCommand,
} from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:   process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const SES_REGION = process.env.AWS_REGION || "us-east-1";

export async function listSenders() {
  const [rows] = await db.query(
    `SELECT * FROM email_senders WHERE is_active = 1 ORDER BY is_default DESC, id ASC`
  );
  return rows;
}

export async function getDefaultSender() {
  const [rows] = await db.query(
    `SELECT * FROM email_senders WHERE is_active = 1 AND is_default = 1 LIMIT 1`
  );
  return rows[0] || null;
}

export async function getSender(id) {
  const [rows] = await db.query(`SELECT * FROM email_senders WHERE id = ?`, [Number(id)]);
  return rows[0] || null;
}

// Resolves the sender for a given job: explicit id → default → env fallback.
export async function resolveSenderForJob(job) {
  if (job?.sender_id) {
    const s = await getSender(job.sender_id);
    if (s && s.is_active) return s;
  }
  const def = await getDefaultSender();
  if (def) return def;
  // Last-resort: env-only synthetic sender
  return {
    id: null,
    email: process.env.SENDER_EMAIL,
    display_name: "Race Auto India",
    reply_to: process.env.SENDER_EMAIL,
    ses_verified: true,
  };
}

// Ask SES for current verification status for the email AND its domain.
// Returns the better of the two — domain verification supersedes email-level.
export async function checkSesVerification(email) {
  const domain = email.split("@")[1];
  const identities = [email];
  if (domain) identities.push(domain);

  const cmd = new GetIdentityVerificationAttributesCommand({ Identities: identities });
  const res = await ses.send(cmd);
  const emailAttr  = res.VerificationAttributes?.[email];
  const domainAttr = domain ? res.VerificationAttributes?.[domain] : null;

  const emailStatus  = emailAttr?.VerificationStatus  || "NotFound";
  const domainStatus = domainAttr?.VerificationStatus || "NotFound";

  // Domain verification covers any address on that domain.
  const verified = emailStatus === "Success" || domainStatus === "Success";
  const status =
    verified ? "Success" :
    emailStatus === "Pending" || domainStatus === "Pending" ? "Pending" :
    "NotFound";

  return {
    identity: email,
    domain,
    status,
    verified,
    emailStatus,
    domainStatus,
    region: SES_REGION,
  };
}

// Trigger SES to send the verification email to this address.
// SES will email a clickable confirmation link to the recipient.
export async function requestEmailVerification(email) {
  await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: email }));
  return { ok: true, message: `Verification email sent to ${email} (check inbox + spam).` };
}

// Register a domain with SES and (separately) request DKIM tokens.
// Returns the TXT and CNAME records the user must add to DNS.
export async function requestDomainVerification(domain) {
  const verifyRes = await ses.send(new VerifyDomainIdentityCommand({ Domain: domain }));
  const dkimRes   = await ses.send(new VerifyDomainDkimCommand({ Domain: domain }));
  return {
    ok: true,
    domain,
    txtRecord: {
      name: `_amazonses.${domain}`,
      value: verifyRes.VerificationToken,
      type: "TXT",
    },
    cnameRecords: (dkimRes.DkimTokens || []).map((token) => ({
      name: `${token}._domainkey.${domain}`,
      value: `${token}.dkim.amazonses.com`,
      type: "CNAME",
    })),
  };
}

// Convenience: list every verified email registered in this SES account.
export async function listVerifiedSesIdentities() {
  try {
    const out = await ses.send(new ListVerifiedEmailAddressesCommand({}));
    return out.VerifiedEmailAddresses || [];
  } catch (e) {
    return [];
  }
}

// Account-level info: are we in sandbox mode? what's our quota?
export async function getSesAccountInfo() {
  try {
    const [quota, enabled] = await Promise.all([
      ses.send(new GetSendQuotaCommand({})),
      ses.send(new GetAccountSendingEnabledCommand({})),
    ]);
    return {
      region: SES_REGION,
      sendingEnabled: !!enabled.Enabled,
      max24Hour: quota.Max24HourSend,
      sentLast24h: quota.SentLast24Hours,
      maxSendRate: quota.MaxSendRate,
      // Heuristic: AWS default sandbox quota is 200/day. If quota is exactly 200
      // and sending is enabled, you're almost certainly in sandbox.
      likelySandbox: quota.Max24HourSend <= 200,
    };
  } catch (e) {
    const msg = String(e?.message || "");
    // Detect AWS auto-quarantine of a leaked key.
    const quarantined = /AWSCompromisedKeyQuarantine/i.test(msg);
    return {
      region: SES_REGION,
      error: msg,
      quarantined,
      authError: /AccessDenied|UnauthorizedOperation|InvalidClientTokenId|SignatureDoesNotMatch/i.test(msg),
    };
  }
}
