import { NextResponse } from "next/server";
import { s3HealthCheck, isS3Configured } from "@/lib/s3";

export async function GET() {
  if (!isS3Configured()) {
    return NextResponse.json({ ok: false, configured: false, error: "AWS_S3_BUCKET not set in .env" });
  }
  const info = await s3HealthCheck();
  return NextResponse.json({ configured: true, ...info });
}
