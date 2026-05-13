import { NextResponse } from "next/server";
import { getJobProgress } from "@/lib/jobs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }
  const data = await getJobProgress(jobId);
  if (!data) {
    return NextResponse.json({ error: "Unknown jobId" }, { status: 404 });
  }
  return NextResponse.json(data);
}
