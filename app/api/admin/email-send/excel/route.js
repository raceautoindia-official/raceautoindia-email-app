// ✅ New API Route: /api/admin/email-send/excel

import { NextResponse } from "next/server";
import { sendBulkEmails } from "@/lib/awsclient";
import * as XLSX from "xlsx";
import db from "@/lib/db"; // optional if needed later

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const subject = formData.get("subject");
    const message = formData.get("message");

    if (!file || !subject || !message) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    const emailList = data
      .map((row) => row.email || row.Email || row["Email Address"])
      .filter((email) => !!email);

    if (emailList.length === 0) {
      return NextResponse.json({ success: false, error: "No valid emails found." }, { status: 400 });
    }

    for (const email of emailList) {
      const encoded = encodeURIComponent(email);
      const html = message
        .replace("{{unsubscribe_link}}", `https://newsletter.raceautoindia.com/subscription/unsubscribe?email=${encoded}`)
        .replace("{{visible_email}}", email);

      await sendBulkEmails([email], subject, html);
    }

    return NextResponse.json({ success: true, message: `${emailList.length} emails sent.` });
  } catch (err) {
    console.error("Excel email send error:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
