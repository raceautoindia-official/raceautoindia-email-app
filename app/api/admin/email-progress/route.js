import { NextResponse } from "next/server";
import progressStore from "@/lib/emailProgressStore";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId || !progressStore.has(jobId)) {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }

  const { total, completed } = progressStore.get(jobId);
  const percent = Math.round((completed / total) * 100);

  return NextResponse.json({ total, completed, percent });
}