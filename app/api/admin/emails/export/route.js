import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as XLSX from "xlsx";

function buildFilters(searchParams) {
  const where = ["e.deleted_at IS NULL"];
  const params = [];
  const q = (searchParams.get("q") || "").trim();
  const categoryId = searchParams.get("category_id");
  const subscribe = searchParams.get("subscribe");
  const lastEvent = searchParams.get("last_event");
  if (q) {
    where.push("e.email LIKE ?");
    params.push(`%${q}%`);
  }
  if (categoryId && categoryId !== "all") {
    where.push("e.category_id = ?");
    params.push(Number(categoryId));
  }
  if (subscribe === "1" || subscribe === "0") {
    where.push("e.subscribe = ?");
    params.push(Number(subscribe));
  }
  if (lastEvent && lastEvent !== "All") {
    if (lastEvent === "Never") where.push("e.last_event_status IS NULL");
    else {
      where.push("e.last_event_status = ?");
      params.push(lastEvent);
    }
  }
  return { whereSql: where.join(" AND "), params };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const emailsParam = searchParams.get("emails");
    let rows;

    if (emailsParam) {
      const list = emailsParam.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!list.length) return NextResponse.json({ error: "No emails" }, { status: 400 });
      const ph = list.map(() => "?").join(",");
      const [r] = await db.query(
        `SELECT e.email, c.name AS category, e.subscribe, e.last_event_status, e.last_event_at, e.created_at
         FROM emails e LEFT JOIN categories c ON c.id = e.category_id
         WHERE e.email IN (${ph})`,
        list
      );
      rows = r;
    } else {
      const { whereSql, params } = buildFilters(searchParams);
      const [r] = await db.query(
        `SELECT e.email, c.name AS category, e.subscribe, e.last_event_status, e.last_event_at, e.created_at
         FROM emails e LEFT JOIN categories c ON c.id = e.category_id
         WHERE ${whereSql}
         ORDER BY e.id DESC`,
        params
      );
      rows = r;
    }

    const header = ["Email", "Category", "Subscribed", "Last Event", "Last Event Time", "Created At"];
    const data = rows.map((r) => [
      r.email,
      r.category || "",
      r.subscribe === 1 ? "Yes" : "No",
      r.last_event_status || "",
      r.last_event_at ? new Date(r.last_event_at).toLocaleString() : "",
      r.created_at ? new Date(r.created_at).toLocaleString() : "",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Subscribers");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="subscribers_${Date.now()}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("export error", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
