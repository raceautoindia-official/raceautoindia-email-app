import db from "@/lib/db"
import { NextResponse } from "next/server"


export async function GET() {
  const [rows] = await db.query('SELECT * FROM categories')
  return NextResponse.json(rows)
}


export async function POST(request) {
  const { name, slug, is_active, description } = await request.json()
  const [result] = await db.execute(
    `INSERT INTO categories (name, slug, is_active, description)
     VALUES (?, ?, ?, ?)`,
    [name, slug, is_active ? 1 : 0, description]
  )
  // fetch the newly created row
  const insertId = result.insertId
  const [newRows] = await db.execute(
    'SELECT * FROM categories WHERE id = ?',
    [insertId]
  )
  return NextResponse.json(newRows[0], { status: 201 })
}

