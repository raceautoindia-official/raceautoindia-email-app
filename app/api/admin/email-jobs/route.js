import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit")) || 50;
  const offset = Number(searchParams.get("offset")) || 0;
  const status = searchParams.get("status") || null;
  const data = await listJobs({ limit, offset, status });
  return NextResponse.json(data);
}
