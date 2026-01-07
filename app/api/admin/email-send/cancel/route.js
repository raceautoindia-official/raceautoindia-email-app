// app/api/admin/email-send/cancel/route.ts

import { cancelMap } from "@/lib/cancelMap";
import { NextResponse } from "next/server";


export async function POST(req) {
  try {
    const { jobId } = await req.json();
    if (!jobId) {
      return NextResponse.json({ success: false, error: "Missing jobId" }, { status: 400 });
    }

    cancelMap.set(jobId, true);
    return NextResponse.json({ success: true, message: `Cancelled job ${jobId}` });
  } catch (err) {
    console.error("Cancel error", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
