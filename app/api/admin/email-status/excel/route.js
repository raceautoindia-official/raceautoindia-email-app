import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status") || "All";
    const q = (searchParams.get("q") || "").trim();
    const jobId = searchParams.get("jobId");
    const campaignId = searchParams.get("campaignId");

    if (!from || !to) {
      return NextResponse.json({ error: "Missing 'from' or 'to'" }, { status: 400 });
    }

    const where = ["eventTime >= ?", "eventTime < DATE_ADD(?, INTERVAL 1 DAY)"];
    const params = [from, to];
    if (status !== "All") {
      where.push("status = ?");
      params.push(status);
    }
    if (q) {
      where.push("email LIKE ?");
      params.push(`%${q}%`);
    }
    if (jobId) {
      if (jobId === "untagged") {
        where.push("job_id IS NULL");
      } else {
        where.push("job_id = ?");
        params.push(Number(jobId));
      }
    }
    if (campaignId) {
      if (campaignId === "untagged") {
        where.push("campaign_id IS NULL");
      } else {
        where.push("campaign_id = ?");
        params.push(Number(campaignId));
      }
    }

    const sql = `
      SELECT email, status, link, ip, userAgent, eventTime
      FROM email_events
      WHERE ${where.join(" AND ")}
      ORDER BY eventTime DESC
    `;
    const [records] = await db.query(sql, params);

    const header = ["Email", "Status", "Link", "IP", "User Agent", "Time"];
    const data = records.map((r) => [
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
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

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
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
