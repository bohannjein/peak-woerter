// Web push for the daily puzzle reminder. VAPID keys are created on first use
// and kept in app_setting, so no extra environment variables are needed
// (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY override them).
import webpush from "web-push";
import type { Db } from "./db";
import { AppError } from "./errors";
import { berlinDay, TZ } from "./time";

export const PUSH_HOUR = 10;
const KEY = "vapidKeys";
const SENT = "puzzlePushSentDay";

export async function vapidKeys(db: Db): Promise<{ publicKey: string; privateKey: string }> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  const row = await db.appSetting.findUnique({ where: { key: KEY } });
  if (row) return row.value as { publicKey: string; privateKey: string };
  const keys = webpush.generateVAPIDKeys();
  // Two first requests at once: keep whichever was stored first.
  await db.appSetting.createMany({ data: [{ key: KEY, value: { ...keys } }], skipDuplicates: true });
  return (await db.appSetting.findUniqueOrThrow({ where: { key: KEY } })).value as unknown as typeof keys;
}

export type SubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export async function subscribe(db: Db, userId: string, sub: SubscriptionInput) {
  if (!/^https:\/\//.test(sub.endpoint)) throw new AppError("Ungültiges Abo.");
  // The same browser may switch accounts: the endpoint belongs to whoever subscribed last.
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function unsubscribe(db: Db, userId: string, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Sends to all (or the given users') browsers; drops subscriptions the push service has forgotten. */
export async function sendPush(db: Db, payload: PushPayload, userIds?: string[]) {
  const subs = await db.pushSubscription.findMany({ where: { ...(userIds ? { userId: { in: userIds } } : {}), user: { disabled: false } } });
  if (!subs.length) return { sent: 0, removed: 0 };
  const { publicKey, privateKey } = await vapidKeys(db);
  const subject = process.env.BETTER_AUTH_URL?.startsWith("https://") ? process.env.BETTER_AUTH_URL : "mailto:admin@localhost";
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          vapidDetails: { subject, publicKey, privateKey },
          TTL: 6 * 3600,
          urgency: "normal",
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id);
        else console.error("push", code ?? e);
      }
    }),
  );
  if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  return { sent, removed: gone.length };
}

export function berlinHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(d));
}

/**
 * Daily reminder: once per Berlin day from PUSH_HOUR on. The day is claimed
 * with a conditional write first, so restarts or several instances send once.
 * `prepare` creates today's rounds so the puzzles are ready when people tap.
 */
export async function dailyPuzzlePush(db: Db, prepare: (day: string) => Promise<void>, now = new Date()) {
  if (berlinHour(now) < PUSH_HOUR) return false;
  const day = berlinDay(now);
  const claimed = await db.$executeRaw`
    INSERT INTO app_setting (key, value, "updatedAt") VALUES (${SENT}, to_jsonb(${day}::text), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = now()
    WHERE app_setting.value IS DISTINCT FROM EXCLUDED.value`;
  if (!claimed) return false;
  await prepare(day);
  await sendPush(db, { title: "Neue Rätsel sind da", body: "Wortjagd, Quartett, Echt oder erfunden? und Sudoku warten auf dich.", url: "/spiele", tag: `raetsel-${day}` });
  return true;
}
