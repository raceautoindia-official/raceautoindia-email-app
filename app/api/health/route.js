import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const info = { ok: true, db: false, time: new Date().toISOString() };
  try {
    await db.query("SELECT 1");
    info.db = true;
  } catch (e) {
    info.ok = false;
    info.error = e.message;
  }
  return NextResponse.json(info, { status: info.ok ? 200 : 500 });
}
