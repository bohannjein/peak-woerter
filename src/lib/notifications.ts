import type { Db, Tx } from "./db";

export async function notify(tx: Db | Tx, userIds: string[], n: { body: string; href?: string; wordId?: string }) {
  const to = [...new Set(userIds)];
  if (to.length) await tx.notification.createMany({ data: to.map((userId) => ({ userId, ...n })) });
}

export const unreadCount = (db: Db, userId: string) => db.notification.count({ where: { userId, readAt: null } });
