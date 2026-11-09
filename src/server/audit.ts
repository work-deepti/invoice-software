import "server-only";
import type { Tx } from "./db";
import { auditLog } from "./db/schema";

type AuditAction = (typeof auditLog.$inferInsert)["action"];

/** AUD-01: every create / update / delete / cancel / restore / settings / rates change. */
export async function writeAudit(
  tx: Tx,
  entry: {
    userId: string | null;
    entity: string;
    entityId?: string | null;
    action: AuditAction;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    userId: entry.userId,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    action: entry.action,
    before: entry.before ?? null,
    after: entry.after ?? null,
    createdBy: entry.userId,
    updatedBy: entry.userId,
  });
}
