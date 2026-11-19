import type { Db } from "../db";
import { auditLog } from "../db/schema";

type Action = "create" | "update" | "delete";

/** Alleen gewijzigde velden vastleggen bij een update. */
export function diff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (key === "updatedAt" || key === "createdAt") continue;
    if (before[key] !== after[key]) changes[key] = { from: before[key] ?? null, to: after[key] ?? null };
  }
  return changes;
}

export function audit(
  db: Db,
  entry: { entityType: string; entityId: string; action: Action; userId: string | null; changes?: unknown },
) {
  return db.insert(auditLog).values({
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    userId: entry.userId,
    changes: entry.changes ?? null,
  });
}
