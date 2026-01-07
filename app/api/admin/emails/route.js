import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import db from "@/lib/db";

const CHUNK_SIZE = 1000;
const GENERAL_CATEGORY = 1; // default

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function GET() {
  try {
    const [data] = await db.query("SELECT * FROM emails");
    if (data.length === 0) {
      return NextResponse.json({ message: "no data found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }

    // 1) Read Excel
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "buffer", dense: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Excel contains no rows" },
        { status: 400 }
      );
    }

    // 2) Load valid category IDs
    const [catRows] = await db.query("SELECT id FROM categories");
    const validCats = new Set(catRows.map((r) => r.id));

    // 3) Extract and dedupe emails + assign categories
    const seenEmails = new Set();
    const validEntries = []; // { email, category_id }
    for (const row of rows) {
      // a) normalize email
      const emailRaw = row.email ?? row.Email ?? "";
      const email = emailRaw.toString().trim().toLowerCase();
      if (
        !email ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        seenEmails.has(email)
      ) {
        continue;
      }

      // b) pick up category_id column (case-insensitive)
      let rawCat =
        row.category_id ??
        row.Category_id ??
        row.categoryId ??
        row.CategoryId ??
        "";
      rawCat = rawCat.toString().trim();
      let catNum = parseInt(rawCat, 10);
      if (isNaN(catNum) || !validCats.has(catNum)) {
        catNum = GENERAL_CATEGORY;
      }

      seenEmails.add(email);
      validEntries.push({ email, category_id: catNum });
    }

    if (validEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid, non-duplicate emails found" },
        { status: 400 }
      );
    }

    // 4) Check existing in DB
    const existingSet = new Set();
    const allEmails = validEntries.map((e) => e.email);
    for (const chunk of chunkArray(allEmails, CHUNK_SIZE)) {
      const placeholders = chunk.map(() => "?").join(",");
      const [rows] = await db.execute(
        `SELECT email FROM emails WHERE email IN (${placeholders})`,
        chunk
      );
      rows.forEach((r) => existingSet.add(r.email));
    }

    // 5) Split into new vs skipped
    const newEntries = validEntries.filter((e) => !existingSet.has(e.email));
    const skippedEmails = validEntries
      .filter((e) => existingSet.has(e.email))
      .map((e) => e.email);

    // 6) If all duplicates, return 409
    if (newEntries.length === 0) {
      const dupCount = skippedEmails.length;
      return NextResponse.json(
        {
          error:
            dupCount <= 200
              ? `All ${dupCount} emails already subscribed: ${skippedEmails.join(
                  ", "
                )}`
              : `All ${dupCount} emails are already subscribed.`,
          duplicateCount: dupCount,
          duplicates: dupCount <= 200 ? skippedEmails : undefined,
        },
        { status: 409 }
      );
    }

    // 7) Bulk insert new entries
    for (const chunk of chunkArray(newEntries, CHUNK_SIZE)) {
      const values = chunk.map((e) => [e.email, 1, e.category_id]);
      await db.query(
        `INSERT INTO emails (email, subscribe, category_id) VALUES ?`,
        [values]
      );
    }

    return NextResponse.json({
      success: true,
      totalRead: validEntries.length,
      inserted: newEntries.length,
      skipped: skippedEmails.length,
      duplicates: skippedEmails,
    });
  } catch (error) {
    console.error("Excel upload error:", error);
    return NextResponse.json(
      { error: "Upload failed. Please try again later." },
      { status: 500 }
    );
  }
}
