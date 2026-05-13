import db from "./db";

const CHUNK = 1000;
function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Resolve email strings → email row ids. Skips emails that don't exist.
export async function resolveEmailIds(emails) {
  if (!emails?.length) return [];
  const ids = [];
  for (const c of chunk(emails, CHUNK)) {
    const ph = c.map(() => "?").join(",");
    const [rows] = await db.execute(
      `SELECT id, email FROM emails WHERE email IN (${ph})`,
      c
    );
    rows.forEach((r) => ids.push({ id: r.id, email: r.email }));
  }
  return ids;
}

export async function setCategoriesForEmail(emailId, categoryIds) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`DELETE FROM email_categories WHERE email_id = ?`, [emailId]);
    if (categoryIds.length) {
      const values = categoryIds.map((cid) => [emailId, cid]);
      await conn.query(
        `INSERT IGNORE INTO email_categories (email_id, category_id) VALUES ?`,
        [values]
      );
      // keep emails.category_id mirror for back-compat (use first category)
      await conn.execute(`UPDATE emails SET category_id = ? WHERE id = ?`, [
        categoryIds[0],
        emailId,
      ]);
    } else {
      await conn.execute(`UPDATE emails SET category_id = NULL WHERE id = ?`, [emailId]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function bulkAddCategories(emailIds, categoryIds) {
  if (!emailIds.length || !categoryIds.length) return 0;
  const values = [];
  for (const eid of emailIds) for (const cid of categoryIds) values.push([eid, cid]);
  let total = 0;
  for (const c of chunk(values, CHUNK)) {
    const [res] = await db.query(
      `INSERT IGNORE INTO email_categories (email_id, category_id) VALUES ?`,
      [c]
    );
    total += res.affectedRows || 0;
  }
  // also mirror emails.category_id to the first added category so legacy code works
  if (categoryIds[0]) {
    for (const c of chunk(emailIds, CHUNK)) {
      const ph = c.map(() => "?").join(",");
      await db.execute(
        `UPDATE emails SET category_id = COALESCE(category_id, ?) WHERE id IN (${ph})`,
        [categoryIds[0], ...c]
      );
    }
  }
  return total;
}

export async function bulkRemoveCategories(emailIds, categoryIds) {
  if (!emailIds.length || !categoryIds.length) return 0;
  let total = 0;
  for (const ec of chunk(emailIds, CHUNK)) {
    const ph1 = ec.map(() => "?").join(",");
    const ph2 = categoryIds.map(() => "?").join(",");
    const [res] = await db.execute(
      `DELETE FROM email_categories
       WHERE email_id IN (${ph1}) AND category_id IN (${ph2})`,
      [...ec, ...categoryIds]
    );
    total += res.affectedRows || 0;
  }
  return total;
}

// Fetch categories for many emails in a single query.
// Returns Map(email_id -> [{id, name, color}, ...])
export async function getCategoriesForEmailIds(emailIds) {
  const m = new Map();
  if (!emailIds.length) return m;
  for (const c of chunk(emailIds, CHUNK)) {
    const ph = c.map(() => "?").join(",");
    const [rows] = await db.query(
      `SELECT ec.email_id, c.id, c.name, c.color, c.position
       FROM email_categories ec
       INNER JOIN categories c ON c.id = ec.category_id AND c.deleted_at IS NULL
       WHERE ec.email_id IN (${ph})
       ORDER BY c.position ASC, c.id ASC`,
      c
    );
    rows.forEach((r) => {
      if (!m.has(r.email_id)) m.set(r.email_id, []);
      m.get(r.email_id).push({ id: r.id, name: r.name, color: r.color });
    });
  }
  return m;
}
