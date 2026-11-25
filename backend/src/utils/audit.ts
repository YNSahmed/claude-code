import type { Queryable } from '../config/db.js';

/** Appends to the immutable admin_audit_log. Call inside the same transaction as the action. */
export async function recordAdminAction(
  db: Queryable,
  entry: { adminId: string; action: string; targetType: string; targetId: string; details?: Record<string, unknown> }
): Promise<void> {
  await db.query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.adminId, entry.action, entry.targetType, entry.targetId, JSON.stringify(entry.details ?? {})]
  );
}
