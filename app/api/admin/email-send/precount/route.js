import { NextResponse } from "next/server";
import db from "@/lib/db";
import { getSuppressedSet } from "@/lib/suppression";

export async function POST(req) {
  try {
    const { source, filter = {} } = await req.json();
    let emails = [];

    if (source === "all") {
      const [rows] = await db.query(
        `SELECT email FROM emails WHERE subscribe = 1 AND deleted_at IS NULL`
      );
      emails = rows.map((r) => r.email);
    } else if (source === "category") {
      const ids = Array.isArray(filter.category_ids) && filter.category_ids.length
        ? filter.category_ids.map(Number).filter(Boolean)
        : filter.category_id
        ? [Number(filter.category_id)]
        : [];
      if (!ids.length) {
        return NextResponse.json({ total: 0, eligible: 0, suppressed: 0, dedup: 0 });
      }
      const ph = ids.map(() => "?").join(",");
      const [rows] = await db.query(
        `SELECT DISTINCT e.email
         FROM emails e
         INNER JOIN email_categories ec ON ec.email_id = e.id
         WHERE e.subscribe = 1 AND e.deleted_at IS NULL
           AND ec.category_id IN (${ph})`,
        ids
      );
      emails = rows.map((r) => r.email);
    } else if (source === "manual") {
      emails = (Array.isArray(filter.emails) ? filter.emails : [])
        .map((e) => String(e || "").trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    } else {
      return NextResponse.json({ error: "Unsupported source" }, { status: 400 });
    }

    const total = emails.length;
    const dedup = Array.from(new Set(emails.map((e) => e.toLowerCase())));
    const suppressed = await getSuppressedSet(dedup);
    const eligible = dedup.length - suppressed.size;

    return NextResponse.json({
      total,
      uniques: dedup.length,
      duplicatesRemoved: total - dedup.length,
      suppressed: suppressed.size,
      eligible,
    });
  } catch (err) {
    console.error("precount error", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
