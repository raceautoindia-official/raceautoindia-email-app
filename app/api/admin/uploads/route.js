import { NextResponse } from "next/server";
import { uploadBuffer, listObjects, deleteObject, isS3Configured } from "@/lib/s3";

const ALLOWED_MIME = new Set([
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(req) {
  if (!isS3Configured()) {
    return NextResponse.json({ error: "S3 is not configured. Set AWS_S3_BUCKET in .env." }, { status: 400 });
  }
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024}MB)` }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const acl = (fd.get("acl") === "public") ? "public-read" : "private";
    const out = await uploadBuffer({
      buffer: buf,
      filename: file.name,
      contentType: file.type,
      acl,
    });
    return NextResponse.json({ success: true, ...out, contentType: file.type });
  } catch (err) {
    console.error("upload error", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  if (!isS3Configured()) {
    return NextResponse.json({ rows: [], error: "S3 not configured" });
  }
  try {
    const rows = await listObjects();
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });
  try {
    await deleteObject(key);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
