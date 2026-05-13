import { NextResponse } from "next/server";
import db from "@/lib/db";
import { addSuppressions } from "@/lib/suppression";
import { audit } from "@/lib/audit";
import { bulkAddCategories, bulkRemoveCategories, resolveEmailIds } from "@/lib/emailCategories";

const ACTIONS = new Set([
  "unsubscribe",
  "resubscribe",
  "delete",
  "soft_delete",
  "set_category",
  "add_categories",
  "remove_categories",
  "suppress",
]);

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function resolveTargetEmails({ emails, filter }) {
  if (Array.isArray(emails) && emails.length) {
    return Array.from(new Set(emails.map((e) => String(e).trim().toLowerCase())));
  }
  if (!filter) return [];
  const where = ["e.deleted_at IS NULL"];
  const params = [];
  const joinParts = [];

  const catIds = Array.isArray(filter.category_ids)
    ? filter.category_ids.map(Number).filter(Boolean)
    : filter.category_id && filter.category_id !== "all"
    ? [Number(filter.category_id)]
    : [];

  if (filter.category_id === "uncategorized") {
    joinParts.push(`LEFT JOIN email_categories ecf ON ecf.email_id = e.id`);
    where.push(`ecf.email_id IS NULL`);
  } else if (catIds.length) {
    const ph = catIds.map(() => "?").join(",");
    joinParts.push(`INNER JOIN email_categories ecf ON ecf.email_id = e.id AND ecf.category_id IN (${ph})`);
    params.push(...catIds);
  }
  if (filter.q) {
    where.push("e.email LIKE ?");
    params.push(`%${filter.q}%`);
  }
  if (filter.subscribe === 0 || filter.subscribe === 1 || filter.subscribe === "0" || filter.subscribe === "1") {
    where.push("e.subscribe = ?");
    params.push(Number(filter.subscribe));
  }
  if (filter.last_event && filter.last_event !== "All") {
    if (filter.last_event === "Never") where.push("e.last_event_status IS NULL");
    else {
      where.push("e.last_event_status = ?");
      params.push(filter.last_event);
    }
  }
  if (filter.from) {
    where.push("e.created_at >= ?");
    params.push(filter.from);
  }
  if (filter.to) {
    where.push("e.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    params.push(filter.to);
  }
  const [rows] = await db.query(
    `SELECT DISTINCT e.email FROM emails e ${joinParts.join(" ")} WHERE ${where.join(" AND ")}`,
    params
  );
  return rows.map((r) => r.email);
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, emails, filter, payload } = body;
    if (!ACTIONS.has(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const targets = await resolveTargetEmails({ emails, filter });
    if (!targets.length) {
      return NextResponse.json({ success: true, affected: 0, requested: 0 });
    }

    let affected = 0;

    if (action === "unsubscribe" || action === "resubscribe") {
      const val = action === "resubscribe" ? 1 : 0;
      for (const c of chunk(targets, 1000)) {
        const ph = c.map(() => "?").join(",");
        const [res] = await db.execute(
          `UPDATE emails SET subscribe = ? WHERE email IN (${ph})`,
          [val, ...c]
        );
        affected += res.affectedRows || 0;
      }
    } else if (action === "delete") {
      for (const c of chunk(targets, 1000)) {
        const ph = c.map(() => "?").join(",");
        const [res] = await db.execute(
          `DELETE FROM emails WHERE email IN (${ph})`,
          c
        );
        affected += res.affectedRows || 0;
      }
    } else if (action === "soft_delete") {
      for (const c of chunk(targets, 1000)) {
        const ph = c.map(() => "?").join(",");
        const [res] = await db.execute(
          `UPDATE emails SET deleted_at = NOW() WHERE email IN (${ph})`,
          c
        );
        affected += res.affectedRows || 0;
      }
    } else if (action === "set_category") {
      const cat = Number(payload?.category_id);
      if (!cat) return NextResponse.json({ error: "Missing category_id" }, { status: 400 });
      const idMap = await resolveEmailIds(targets);
      const eids = idMap.map((r) => r.id);
      // replace with single category: clear existing then add
      for (const c of chunk(eids, 1000)) {
        const ph = c.map(() => "?").join(",");
        await db.execute(`DELETE FROM email_categories WHERE email_id IN (${ph})`, c);
      }
      affected = await bulkAddCategories(eids, [cat]);
    } else if (action === "add_categories") {
      const cats = Array.isArray(payload?.category_ids)
        ? payload.category_ids.map(Number).filter(Boolean)
        : [];
      if (!cats.length) return NextResponse.json({ error: "Missing category_ids" }, { status: 400 });
      const eids = (await resolveEmailIds(targets)).map((r) => r.id);
      affected = await bulkAddCategories(eids, cats);
    } else if (action === "remove_categories") {
      const cats = Array.isArray(payload?.category_ids)
        ? payload.category_ids.map(Number).filter(Boolean)
        : [];
      if (!cats.length) return NextResponse.json({ error: "Missing category_ids" }, { status: 400 });
      const eids = (await resolveEmailIds(targets)).map((r) => r.id);
      affected = await bulkRemoveCategories(eids, cats);
    } else if (action === "suppress") {
      const reason = payload?.reason || "manual";
      affected = await addSuppressions(targets.map((email) => ({ email, reason })));
      for (const c of chunk(targets, 1000)) {
        const ph = c.map(() => "?").join(",");
        await db.execute(`UPDATE emails SET subscribe = 0 WHERE email IN (${ph})`, c);
      }
    }

    await audit({
      action: `bulk:${action}`,
      targetType: "emails",
      payload: { count: targets.length, affected, payload },
    });

    return NextResponse.json({ success: true, affected, requested: targets.length });
  } catch (err) {
    console.error("bulk error", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
