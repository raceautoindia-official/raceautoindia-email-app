import { NextResponse } from "next/server";
import { getJobProgress } from "@/lib/jobs";

export async function GET(_req, context) {
  const { params } = await context;
  const id = Number(params.id);
  const data = await getJobProgress(id);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}
