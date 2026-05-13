import crypto from "crypto";
import https from "https";

// Best-effort SNS signature verification.
// Enabled when VERIFY_SNS_SIGNATURE is truthy. Otherwise returns { ok: true } so
// existing deploys keep working unchanged.
//
// References:
// https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html

const certCache = new Map(); // url -> { pem, expiresAt }
const CERT_TTL_MS = 60 * 60 * 1000;

function fetchCert(url) {
  return new Promise((resolve, reject) => {
    if (!/^https:\/\/sns\.[a-z0-9-]+\.amazonaws\.com\/.+\.pem$/i.test(url)) {
      return reject(new Error("untrusted cert url"));
    }
    const cached = certCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return resolve(cached.pem);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`cert fetch ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const pem = Buffer.concat(chunks).toString("utf-8");
          certCache.set(url, { pem, expiresAt: Date.now() + CERT_TTL_MS });
          resolve(pem);
        });
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function buildStringToSign(msg) {
  const type = msg.Type;
  const keys =
    type === "Notification"
      ? msg.Subject != null
        ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
        : ["Message", "MessageId", "Timestamp", "TopicArn", "Type"]
      : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];
  return keys.map((k) => `${k}\n${msg[k]}\n`).join("");
}

export async function verifySnsMessage(msg) {
  if (!process.env.VERIFY_SNS_SIGNATURE) return { ok: true, skipped: true };
  try {
    if (!msg?.Signature || !msg?.SigningCertURL || !msg?.SignatureVersion) {
      return { ok: false, error: "missing signature fields" };
    }
    const algo = msg.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
    const pem = await fetchCert(msg.SigningCertURL);
    const verifier = crypto.createVerify(algo);
    verifier.update(buildStringToSign(msg), "utf-8");
    const ok = verifier.verify(pem, msg.Signature, "base64");
    return ok ? { ok: true } : { ok: false, error: "bad signature" };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
