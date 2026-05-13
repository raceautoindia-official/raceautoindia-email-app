import { NextResponse } from "next/server";
import { cancelJob } from "@/lib/jobs";

// Backwards-compatible: accepts { jobId } in body and cancels the persistent job.
export async function POST(req) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ success: false, error: "Missing jobId" }, { status: 400 });
    }
    const ok = await cancelJob(jobId);
    return NextResponse.json({ success: ok, message: ok ? `Cancelled job ${jobId}` : `Job ${jobId} not cancellable` });
  } catch (err) {
    console.error("Cancel error", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
