// app/api/admin/email-status/excel/route.js
import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status") || "All";

    // parse page/limit just in case (we'll ignore page here and grab all)
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "1000000", 10);
    const offset = (page - 1) * limit;

    // build parameters for date (+ optional status)
    const params = [from, to];
    let where = "WHERE eventTime BETWEEN ? AND ?";
    if (status !== "All") {
      where += " AND status = ?";
      params.push(status);
    }

    // interpolate LIMIT/OFFSET directly (no placeholders)
    const sql = `
      SELECT email, status, link, ip, userAgent, eventTime
      FROM email_events
      ${where}
      ORDER BY eventTime DESC
      LIMIT ${offset}, ${limit}
    `;

    const [records] = await db.execute(sql, params);

    // build worksheet
    const header = ["Email", "Status", "Link", "IP", "User Agent", "Time"];
    const data = records.map(r => [
      r.email,
      r.status,
      r.link || "",
      r.ip || "",
      r.userAgent || "",
      new Date(r.eventTime).toLocaleString(),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");

    // write to buffer
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    // return as an attachment
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="email_report_${from}_${to}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Excel export error:", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
