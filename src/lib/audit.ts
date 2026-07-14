import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { auditLog } from "@/db/schema";

export function writeAudit(
  action: string,
  entityType: "opportunity" | "submission" | "report",
  entityId: string,
  detail?: Record<string, unknown>,
): void {
  try {
    db.insert(auditLog)
      .values({
        id: randomUUID(),
        actor: "admin",
        action,
        entityType,
        entityId,
        detail: detail ? JSON.stringify(detail) : null,
      })
      .run();
  } catch {
    // the audit trail must never block the action itself
  }
}
