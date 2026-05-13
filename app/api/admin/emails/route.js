import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import db from "@/lib/db";
import { getCategoriesForEmailIds } from "@/lib/emailCategories";

const CHUNK_SIZE = 1000;

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function buildFilters(searchParams) {
  const where = ["e.deleted_at IS NULL"];
  const params = [];
  const joinParts = [];

  const q = (searchParams.get("q") || "").trim();
  const subscribe = searchParams.get("subscribe");
  const lastEvent = searchParams.get("last_event");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // category filter — supports ?category_id=N OR ?category_ids=1,2,3
  const catSingle = searchParams.get("category_id");
  const catMulti = searchParams.get("category_ids");
  let catIds = [];
  if (catMulti) {
    catIds = catMulti.split(",").map((n) => Number(n)).filter(Boolean);
  } else if (catSingle && catSingle !== "all") {
    catIds = [Number(catSingle)];
  }
  if (catSingle === "uncategorized") {
    joinParts.push(`LEFT JOIN email_categories ecf ON ecf.email_id = e.id`);
    where.push(`ecf.email_id IS NULL`);
  } else if (catIds.length) {
    const ph = catIds.map(() => "?").join(",");
    joinParts.push(
      `INNER JOIN email_categories ecf ON ecf.email_id = e.id AND ecf.category_id IN (${ph})`
    );
    params.push(...catIds);
  }

  if (q) {
    where.push("e.email LIKE ?");
    params.push(`%${q}%`);
  }
  if (subscribe === "1" || subscribe === "0") {
    where.push("e.subscribe = ?");
    params.push(Number(subscribe));
  }
  if (lastEvent && lastEvent !== "All") {
    if (lastEvent === "Never") {
      where.push("e.last_event_status IS NULL");
    } else {
      where.push("e.last_event_status = ?");
      params.push(lastEvent);
    }
  }
  if (from) {
    where.push("e.created_at >= ?");
    params.push(from);
  }
  if (to) {
    where.push("e.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(to);
  }

  return {
    whereSql: where.join(" AND "),
    joinSql: joinParts.join(" "),
    params,
  };
}

const GENERAL_CATEGORY = 1;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Math.min(500, Number(searchParams.get("limit")) || 25));
    const offset = (page - 1) * limit;

    const sort = (searchParams.get("sort") || "id_desc").toLowerCase();
    const sortMap = {
      id_desc: "e.id DESC",
      id_asc: "e.id ASC",
      email_asc: "e.email ASC",
      email_desc: "e.email DESC",
      subscribe_asc: "e.subscribe ASC",
      subscribe_desc: "e.subscribe DESC",
      created_desc: "e.created_at DESC",
      created_asc: "e.created_at ASC",
    };
    const orderBy = sortMap[sort] || sortMap.id_desc;

    const { whereSql, joinSql, params } = buildFilters(searchParams);

    const [rows] = await db.query(
      `SELECT DISTINCT e.id, e.email, e.subscribe, e.created_at,
              e.last_event_at, e.last_event_status
       FROM emails e
       ${joinSql}
       WHERE ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT e.id) AS total
       FROM emails e
       ${joinSql}
       WHERE ${whereSql}`,
      params
    );

    const catMap = await getCategoriesForEmailIds(rows.map((r) => r.id));
    const enriched = rows.map((r) => ({
      ...r,
      categories: catMap.get(r.id) || [],
    }));

    return NextResponse.json({ rows: enriched, total, page, limit });
  } catch (err) {
    console.error("emails GET error:", err);
    return NextResponse.json({ message: "internal server error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }

    // Optional column mapping from wizard: { email: "Email Address", categories: "Tags", first_name: "First", last_name: "Last" }
    let mapping = null;
    const mappingStr = formData.get("mapping");
    if (mappingStr) {
      try { mapping = JSON.parse(String(mappingStr)); } catch {}
    }
    // Strict mode: when "true", any row with an unknown category is rejected.
    // When "false" (default), unknown categories are dropped but the email row is still imported.
    const strictCategories = String(formData.get("strict_categories") || "").toLowerCase() === "true";

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "buffer", dense: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return NextResponse.json({ error: "Excel contains no rows" }, { status: 400 });
    }

    const [catRows] = await db.query(
      `SELECT id, name, LOWER(name) AS lname FROM categories WHERE deleted_at IS NULL`
    );
    const validCatIds = new Set(catRows.map((r) => r.id));
    const catByName = new Map(catRows.map((r) => [r.lname, r.id]));

    function resolveCategories(row) {
      // Multi: column "categories" comma-separated names or ids
      const multi = (row.categories ?? row.Categories ?? row.tags ?? row.Tags ?? "").toString().trim();
      if (multi) {
        return multi
          .split(/[,;|]/)
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => {
            const num = parseInt(p, 10);
            if (!isNaN(num) && validCatIds.has(num)) return num;
            return catByName.get(p.toLowerCase()) || null;
          })
          .filter(Boolean);
      }
      // Legacy single-cat columns
      const single = (
        row.category_id ?? row.Category_id ?? row.categoryId ?? row.CategoryId ?? ""
      ).toString().trim();
      if (single) {
        const num = parseInt(single, 10);
        if (!isNaN(num) && validCatIds.has(num)) return [num];
        const byName = catByName.get(single.toLowerCase());
        if (byName) return [byName];
      }
      const singleName = (row.category_name ?? row.Category ?? row.category ?? "")
        .toString().trim().toLowerCase();
      if (singleName && catByName.has(singleName)) return [catByName.get(singleName)];
      return [];
    }

    const seen = new Set();
    const valid = [];
    let invalid = 0;
    let dupInFile = 0;
    const rejectedRows = []; // { row, email, reason }

    const emailKey = mapping?.email || null;
    const fnameKey = mapping?.first_name || null;
    const lnameKey = mapping?.last_name || null;

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNum = idx + 2; // human-friendly row number (header = 1)
      const emailRaw = (emailKey ? row[emailKey] : null) ?? row.email ?? row.Email ?? row["Email Address"] ?? "";
      const email = emailRaw.toString().trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        invalid++;
        rejectedRows.push({ row: rowNum, email: email || null, reason: "Invalid or missing email" });
        continue;
      }
      if (seen.has(email)) {
        dupInFile++;
        rejectedRows.push({ row: rowNum, email, reason: "Duplicate of an earlier row" });
        continue;
      }
      seen.add(email);

      // Categories — split each ref, resolve, and remember the unresolved ones
      let cats = [];
      let unknownCats = [];
      const catCellSrc = mapping?.categories ? row[mapping.categories] : null;
      const useCatCell = catCellSrc !== undefined && catCellSrc !== null && String(catCellSrc) !== "";
      if (useCatCell) {
        const refs = String(catCellSrc).split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
        for (const ref of refs) {
          const num = parseInt(ref, 10);
          let resolved = null;
          if (!isNaN(num) && validCatIds.has(num)) resolved = num;
          else if (catByName.has(ref.toLowerCase())) resolved = catByName.get(ref.toLowerCase());
          if (resolved) cats.push(resolved);
          else unknownCats.push(ref);
        }
      } else if (!mapping) {
        // Legacy auto-detection (no wizard mapping)
        cats = resolveCategories(row);
      }

      if (unknownCats.length && strictCategories) {
        rejectedRows.push({
          row: rowNum,
          email,
          reason: `Unknown categor${unknownCats.length > 1 ? "ies" : "y"}: ${unknownCats.map((u) => `"${u}"`).join(", ")}`,
        });
        continue;
      }

      const primary = cats[0] || GENERAL_CATEGORY;
      const first_name = fnameKey ? (row[fnameKey] || "").toString().trim() : null;
      const last_name  = lnameKey ? (row[lnameKey] || "").toString().trim() : null;
      valid.push({ email, primary, cats, first_name, last_name, unknownCats });
    }

    if (!valid.length) {
      return NextResponse.json(
        { error: "No valid, non-duplicate emails found", invalid, dupInFile },
        { status: 400 }
      );
    }

    let inserted = 0;
    let updated = 0;
    let categoryLinks = 0;

    for (const slice of chunkArray(valid, CHUNK_SIZE)) {
      const values = slice.map((e) => [e.email, 1, e.primary]);
      const [res] = await db.query(
        `INSERT INTO emails (email, subscribe, category_id) VALUES ?
         ON DUPLICATE KEY UPDATE
           category_id = VALUES(category_id),
           updated_at  = NOW()`,
        [values]
      );
      const aff = res.affectedRows || 0;
      const updatedInChunk = aff - slice.length;
      const insertedInChunk = slice.length - updatedInChunk;
      inserted += Math.max(0, insertedInChunk);
      updated += Math.max(0, updatedInChunk);

      // resolve email_id for each row in this slice and link many-to-many
      const ph = slice.map(() => "?").join(",");
      const [idRows] = await db.execute(
        `SELECT id, email FROM emails WHERE email IN (${ph})`,
        slice.map((s) => s.email)
      );
      const idMap = new Map(idRows.map((r) => [r.email, r.id]));

      // update first_name / last_name when mapping provided them
      for (const s of slice) {
        const eid = idMap.get(s.email);
        if (!eid) continue;
        if (s.first_name || s.last_name) {
          await db.execute(
            `UPDATE emails SET first_name = COALESCE(NULLIF(?, ''), first_name),
                              last_name  = COALESCE(NULLIF(?, ''), last_name)
             WHERE id = ?`,
            [s.first_name || "", s.last_name || "", eid]
          );
        }
      }

      const links = [];
      for (const s of slice) {
        const eid = idMap.get(s.email);
        if (!eid) continue;
        for (const cid of s.cats) links.push([eid, cid]);
      }
      for (const linkChunk of chunkArray(links, CHUNK_SIZE)) {
        if (!linkChunk.length) continue;
        const [r] = await db.query(
          `INSERT IGNORE INTO email_categories (email_id, category_id) VALUES ?`,
          [linkChunk]
        );
        categoryLinks += r.affectedRows || 0;
      }
    }

    // Count rows where we silently dropped unknown categories (non-strict mode)
    const rowsWithDroppedCats = valid.filter((v) => v.unknownCats?.length).length;

    return NextResponse.json({
      success: true,
      totalRead: valid.length,
      inserted,
      updated,
      categoryLinks,
      skipped: dupInFile + invalid + rejectedRows.filter((r) => r.reason.startsWith("Unknown")).length,
      invalid,
      dupInFile,
      strictCategories,
      rowsWithDroppedCats,
      // First 200 problem rows (human-readable). UI can offer download for full list later.
      rejectedRows: rejectedRows.slice(0, 200),
      rejectedRowsTruncated: rejectedRows.length > 200,
      rejectedTotal: rejectedRows.length,
    });
  } catch (error) {
    console.error("Excel upload error:", error);
    return NextResponse.json(
      { error: "Upload failed. Please try again later." },
      { status: 500 }
    );
  }
}
