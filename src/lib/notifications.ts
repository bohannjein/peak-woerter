import type { Db, Tx } from "./db";
import type { PushKind } from "./pushKinds";

/** In-app message; with a kind the minute clock also pushes it (lib/push.ts flushNotifications). */
export async function notify(tx: Db | Tx, userIds: string[], n: { body: string; href?: string; wordId?: string; kind?: PushKind }) {
  const to = [...new Set(userIds)];
  if (to.length) await tx.notification.createMany({ data: to.map((userId) => ({ userId, ...n })) });
}

/** All curators except `except` (who started it) get a message about a round. */
export async function notifyCurators(tx: Db | Tx, except: string | null, n: { body: string; href?: string; wordId?: string; kind?: PushKind }) {
  const seats = await tx.curatorSeat.findMany({ where: { user: { disabled: false }, ...(except ? { userId: { not: except } } : {}) }, select: { userId: true } });
  await notify(tx, seats.map((s) => s.userId), n);
}

export const unreadCount = (db: Db, userId: string) => db.notification.count({ where: { userId, readAt: null } });
