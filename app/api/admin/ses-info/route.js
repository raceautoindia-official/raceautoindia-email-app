import { NextResponse } from "next/server";
import { getSesAccountInfo } from "@/lib/senders";

export async function GET() {
  const info = await getSesAccountInfo();
  return NextResponse.json(info);
}
