import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import db from "@/lib/db";

// Generates a sample Excel with the expected columns + a few example rows
// pre-populated using ACTUAL category names from the database, so users
// know exactly what values are accepted.
export async function GET() {
  const [cats] = await db.query(
    `SELECT name FROM categories WHERE deleted_at IS NULL ORDER BY position ASC, id ASC`
  );
  const names = cats.map((c) => c.name);
  const cat1 = names[0] || "general";
  const cat2 = names[1] || cat1;

  const headers = ["email", "first_name", "last_name", "categories"];
  const rows = [
    headers,
    ["jane@example.com",  "Jane", "Doe",   cat1],
    ["john@example.com",  "John", "Smith", `${cat1}, ${cat2}`],
    ["mary@example.com",  "Mary", "Lee",   ""], // optional
  ];

  // Add an "Available categories" reference sheet
  const refRows = [
    ["Available categories — use these EXACT names (or numeric ids) in the categories column"],
    [],
    ["id", "name"],
    ...cats.map((_, i) => [_, _.name]),
  ];
  const [catRows] = await db.query(
    `SELECT id, name FROM categories WHERE deleted_at IS NULL ORDER BY position ASC, id ASC`
  );
  const refSheet = [
    ["Available categories"],
    ["Use the EXACT name (or numeric id) from this list in the categories column."],
    [],
    ["id", "name"],
    ...catRows.map((r) => [r.id, r.name]),
  ];

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws1, "Subscribers");
  const ws2 = XLSX.utils.aoa_to_sheet(refSheet);
  XLSX.utils.book_append_sheet(wb, ws2, "Categories (reference)");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="subscribers_template.xlsx"',
    },
  });
}
