import { NextResponse } from "next/server";
import { resumeJob } from "@/lib/jobs";
import "@/lib/workerBoot";

export async function POST(_req, context) {
  const { params } = await context;
  const id = Number(params.id);
  const ok = await resumeJob(id);
  return NextResponse.json({ success: ok });
}
