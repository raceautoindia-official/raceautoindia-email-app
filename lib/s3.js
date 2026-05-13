import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import path from "path";

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.AWS_S3_BUCKET;
const PREFIX = (process.env.AWS_S3_PREFIX || "").replace(/^\/|\/$/g, "");
const PUBLIC_URL = (process.env.AWS_S3_PUBLIC_URL || "").replace(/\/$/, "");

const s3 = new S3Client({
  region: REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined, // when blank, SDK auto-discovers (IAM role on EC2 etc.)
});

export function isS3Configured() {
  return !!BUCKET;
}

function buildKey(filename) {
  const ext = path.extname(filename || "").toLowerCase();
  const base = path.basename(filename || "file", ext).replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomBytes(6).toString("hex");
  const k = `${PREFIX ? PREFIX + "/" : ""}${stamp}/${base}-${rand}${ext}`;
  return k;
}

function publicUrlFor(key) {
  if (PUBLIC_URL) return `${PUBLIC_URL}/${key}`;
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

export async function uploadBuffer({ buffer, filename, contentType, acl = "private" }) {
  if (!BUCKET) throw new Error("AWS_S3_BUCKET is not configured");
  const key = buildKey(filename);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType || "application/octet-stream",
    ACL: acl, // "private" | "public-read"
    CacheControl: "public, max-age=31536000",
  }));
  return {
    key,
    url: acl === "public-read" ? publicUrlFor(key) : null,
    size: buffer.length,
  };
}

export async function deleteObject(key) {
  if (!BUCKET) throw new Error("AWS_S3_BUCKET is not configured");
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export async function listObjects(subPrefix = "") {
  if (!BUCKET) throw new Error("AWS_S3_BUCKET is not configured");
  const prefix = (PREFIX ? PREFIX + "/" : "") + (subPrefix || "");
  const out = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
  return (out.Contents || []).map((o) => ({
    key: o.Key,
    size: o.Size,
    lastModified: o.LastModified,
    publicUrl: publicUrlFor(o.Key),
  }));
}

export async function getPresignedDownloadUrl(key, expiresInSec = 300) {
  if (!BUCKET) throw new Error("AWS_S3_BUCKET is not configured");
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: expiresInSec });
}

export async function getPresignedUploadUrl({ filename, contentType, expiresInSec = 300 }) {
  if (!BUCKET) throw new Error("AWS_S3_BUCKET is not configured");
  const key = buildKey(filename);
  const url = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: BUCKET, Key: key, ContentType: contentType,
  }), { expiresIn: expiresInSec });
  return { key, uploadUrl: url, publicUrl: publicUrlFor(key) };
}

// Health check used by Settings page.
export async function s3HealthCheck() {
  if (!BUCKET) return { ok: false, error: "AWS_S3_BUCKET not set" };
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    return { ok: true, bucket: BUCKET, region: REGION };
  } catch (e) {
    return {
      ok: false,
      bucket: BUCKET,
      error: e.message,
      authError: /AccessDenied|UnauthorizedOperation|InvalidClientTokenId/i.test(e.message),
      quarantined: /AWSCompromisedKeyQuarantine/i.test(e.message),
    };
  }
}
