import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import db from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCategoryCell(cell) {
  if (cell == null) return [];
  return String(cell)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req) {
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    const mappingStr = fd.get("mapping");
    let mapping = null;
    if (mappingStr) { try { mapping = JSON.parse(String(mappingStr)); } catch {} }

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", dense: true });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) return NextResponse.json({ error: "Sheet is empty" }, { status: 400 });

    const headers = Object.keys(rows[0]);
    const lower = headers.map((h) => h.toLowerCase());

    // Auto-detect mapping if user hasn't provided one
    const detectedEmail =
      headers[lower.indexOf("email")] ||
      headers[lower.indexOf("email address")] ||
      headers[lower.indexOf("e-mail")] ||
      headers.find((h) => /e-?mail/i.test(h)) || null;
    const detectedCategories =
      headers[lower.indexOf("categories")] ||
      headers[lower.indexOf("tags")] ||
      headers[lower.indexOf("category")] ||
      headers[lower.indexOf("category_name")] ||
      headers[lower.indexOf("category_id")] || null;
    const detectedFirstName =
      headers[lower.indexOf("first_name")] ||
      headers[lower.indexOf("firstname")] ||
      headers[lower.indexOf("first name")] || null;
    const detectedLastName =
      headers[lower.indexOf("last_name")] ||
      headers[lower.indexOf("lastname")] ||
      headers[lower.indexOf("last name")] || null;

    const detected = {
      email: detectedEmail,
      categories: detectedCategories,
      first_name: detectedFirstName,
      last_name: detectedLastName,
    };

    // Active mapping (user-provided wins, otherwise auto)
    const m = {
      email: mapping?.email || detected.email,
      categories: mapping?.categories || detected.categories,
      first_name: mapping?.first_name || detected.first_name,
      last_name: mapping?.last_name || detected.last_name,
    };

    // Load DB categories for validation
    const [catRows] = await db.query(
      `SELECT id, name FROM categories WHERE deleted_at IS NULL`
    );
    const validCatIds = new Set(catRows.map((r) => r.id));
    const catByName = new Map(catRows.map((r) => [r.name.toLowerCase(), r.id]));
    const availableCategories = catRows.map((r) => ({ id: r.id, name: r.name }));

    // Per-row validation
    const seen = new Set();
    let valid = 0, invalidEmail = 0, dup = 0;
    const rowErrors = []; // [{ row, email, errors: [{ type, msg }] }]
    const unknownCategoryRefs = new Map(); // ref -> count

    rows.forEach((r, idx) => {
      const errs = [];
      const rowNumber = idx + 2; // +1 for header, +1 for human counting
      const emailRaw = m.email ? r[m.email] : null;
      const email = (emailRaw ?? "").toString().trim().toLowerCase();

      if (!email) errs.push({ type: "email_missing", msg: "Email is empty" });
      else if (!EMAIL_RE.test(email)) errs.push({ type: "email_invalid", msg: `Invalid email format: "${email}"` });
      else if (seen.has(email)) {
        errs.push({ type: "duplicate", msg: `Duplicate of an earlier row` });
        dup++;
      } else {
        seen.add(email);
      }

      // Category validation
      if (m.categories && r[m.categories] != null && r[m.categories] !== "") {
        const refs = parseCategoryCell(r[m.categories]);
        const unknown = [];
        for (const ref of refs) {
          const num = parseInt(ref, 10);
          let resolved = null;
          if (!isNaN(num) && validCatIds.has(num)) resolved = num;
          else if (catByName.has(ref.toLowerCase())) resolved = catByName.get(ref.toLowerCase());
          if (!resolved) unknown.push(ref);
        }
        if (unknown.length) {
          errs.push({
            type: "category_unknown",
            msg: `Unknown categor${unknown.length > 1 ? "ies" : "y"}: ${unknown.map((u) => `"${u}"`).join(", ")}`,
            unknown,
          });
          unknown.forEach((u) => unknownCategoryRefs.set(u, (unknownCategoryRefs.get(u) || 0) + 1));
        }
      }

      // Track quality counts
      if (errs.some((e) => e.type === "email_missing" || e.type === "email_invalid")) invalidEmail++;
      else if (!errs.some((e) => e.type === "duplicate")) valid++;

      if (errs.length) rowErrors.push({ row: rowNumber, email: email || null, errors: errs });
    });

    return NextResponse.json({
      sheetName,
      totalRows: rows.length,
      headers,
      preview: rows.slice(0, 20),
      detected,
      mapping: m,
      availableCategories,
      quality: {
        valid,
        invalidEmail,
        duplicate: dup,
        rowsWithIssues: rowErrors.length,
        rowsWithUnknownCategories: rowErrors.filter((r) => r.errors.some((e) => e.type === "category_unknown")).length,
      },
      unknownCategoryRefs: Array.from(unknownCategoryRefs.entries()).map(([ref, count]) => ({ ref, count })),
      // Cap detail list to keep payload small
      rowErrors: rowErrors.slice(0, 200),
      rowErrorsTruncated: rowErrors.length > 200,
    });
  } catch (err) {
    console.error("preview-upload error", err);
    return NextResponse.json({ error: "Could not read file" }, { status: 500 });
  }
}
