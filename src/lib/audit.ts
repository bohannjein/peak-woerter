import type { Tx, Db } from "./db";
import type { Prisma } from "@/generated/prisma/client";

export function audit(tx: Tx | Db, actorId: string | null, action: string, entityType: string, entityId: string | null, data?: Prisma.InputJsonValue) {
  return tx.auditLog.create({ data: { actorId, action, entityType, entityId, data } });
}
