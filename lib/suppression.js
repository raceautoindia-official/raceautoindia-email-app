import db from "./db";

const CHUNK = 1000;

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export async function getSuppressedSet(emails) {
  if (!emails?.length) return new Set();
  const set = new Set();
  for (const c of chunk(emails, CHUNK)) {
    const placeholders = c.map(() => "?").join(",");
    const [rows] = await db.execute(
      `SELECT email FROM email_suppressions WHERE email IN (${placeholders})`,
      c
    );
    rows.forEach((r) => set.add(r.email));
  }
  return set;
}

export async function addSuppressions(entries) {
  if (!entries?.length) return 0;
  let added = 0;
  for (const c of chunk(entries, CHUNK)) {
    const values = c.map((e) => [e.email, e.reason || "manual", e.source || null, e.notes || null]);
    const [res] = await db.query(
      `INSERT IGNORE INTO email_suppressions (email, reason, source, notes) VALUES ?`,
      [values]
    );
    added += res.affectedRows || 0;
  }
  return added;
}

export async function removeSuppression(email) {
  const [res] = await db.execute(
    `DELETE FROM email_suppressions WHERE email = ?`,
    [email]
  );
  return res.affectedRows || 0;
}
