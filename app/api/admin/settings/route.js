import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  const [rows] = await db.query(`SELECT setting_key, setting_value FROM app_settings`);
  const map = {};
  rows.forEach((r) => { map[r.setting_key] = r.setting_value; });
  return NextResponse.json(map);
}

export async function PUT(req) {
  const body = await req.json();
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const entries = Object.entries(body);
  for (const [k, v] of entries) {
    await db.execute(
      `INSERT INTO app_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [String(k), v == null ? null : String(v)]
    );
  }
  return NextResponse.json({ success: true, updated: entries.length });
}
