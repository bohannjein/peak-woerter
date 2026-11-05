import { db } from "./db";
import { APP_VERSION, compareVersions, unseenReleases } from "./changelog";

/**
 * What the person has not seen yet. A brand-new account has no version yet: it
 * starts at the current one quietly instead of getting old news.
 */
export async function pendingNews(userId: string, seen: string | null) {
  if (seen === null) {
    await db.user.update({ where: { id: userId }, data: { seenVersion: APP_VERSION } });
    return [];
  }
  return unseenReleases(seen);
}

/** Only ever moves forward, so a rollback does not show the news again later. */
export async function markNewsSeen(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, select: { seenVersion: true } });
  if (u?.seenVersion && compareVersions(u.seenVersion, APP_VERSION) >= 0) return;
  await db.user.update({ where: { id: userId }, data: { seenVersion: APP_VERSION } });
}
