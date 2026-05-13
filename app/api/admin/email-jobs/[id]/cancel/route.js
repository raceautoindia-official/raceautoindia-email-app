import { NextResponse } from "next/server";
import { cancelJob } from "@/lib/jobs";

export async function POST(_req, context) {
  const { params } = await context;
  const id = Number(params.id);
  const ok = await cancelJob(id);
  return NextResponse.json({ success: ok });
}
