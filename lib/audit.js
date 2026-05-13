import db from "./db";

export async function audit({ actor, action, targetType, targetId, payload, ip, userAgent }) {
  try {
    await db.execute(
      `INSERT INTO audit_log (actor, action, target_type, target_id, payload, ip, user_agent)
       VALUES (?,?,?,?,?,?,?)`,
      [
        actor || null,
        action,
        targetType || null,
        targetId ? String(targetId) : null,
        payload ? JSON.stringify(payload) : null,
        ip || null,
        userAgent || null,
      ]
    );
  } catch (err) {
    // audit failures should never break the main flow
    console.warn("audit log failed:", err.message);
  }
}
