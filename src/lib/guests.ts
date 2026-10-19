// Guest mode: read-only access to the collection without an account.
// Admin issues links (single use or time-limited) or opens the site for a while.
// Every guest browser gets its own GuestSession; community votes are tied to it.
import type { Db, Tx } from "./db";
import { AppError } from "./errors";
import { audit } from "./audit";
import { newToken, sha256 } from "./accounts";
import { getSettings, guestOpenNow } from "./settings";

export const GUEST_COOKIE = "peake_guest";
const HOUR = 3600_000;

export async function createGuestLink(db: Db, input: { createdById: string; label: string | null; singleUse: boolean; hours: number }) {
  if (!(await getSettings(db)).guestEnabled) throw new AppError("Gastmodus ist ausgeschaltet.");
  const token = newToken();
  await db.guestAccess.create({
    data: {
      tokenHash: sha256(token),
      label: input.label,
      singleUse: input.singleUse,
      expiresAt: new Date(Date.now() + input.hours * HOUR),
      createdById: input.createdById,
    },
  });
  await audit(db, input.createdById, "guest.link_created", "guest_access", null, { singleUse: input.singleUse, hours: input.hours });
  return token;
}

async function newSession(db: Db | Tx, accessId: string | null, expiresAt: Date | null) {
  const token = newToken();
  await db.guestSession.create({ data: { tokenHash: sha256(token), accessId, expiresAt } });
  return { token, expiresAt };
}

/** Turns a guest link into a guest session. Single-use links work exactly once. */
export async function redeemGuestLink(db: Db, token: string) {
  if (!(await getSettings(db)).guestEnabled) return null;
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; expiresAt: Date; singleUse: boolean }[]>`
      SELECT id, "expiresAt", "singleUse" FROM guest_access WHERE "tokenHash" = ${sha256(token)}
        AND "revokedAt" IS NULL AND "usedAt" IS NULL AND "expiresAt" > now() FOR UPDATE`;
    const a = rows[0];
    if (!a) return null;
    if (a.singleUse) await tx.guestAccess.update({ where: { id: a.id }, data: { usedAt: new Date() } });
    return newSession(tx, a.id, a.expiresAt);
  });
}

/** Open mode: anyone gets a fresh guest session while the site is open. */
export async function openGuestSession(db: Db) {
  const s = await getSettings(db);
  if (!guestOpenNow(s)) return null;
  return newSession(db, null, s.guestOpenUntil === "immer" ? null : new Date(s.guestOpenUntil));
}

export async function guestSession(db: Db, token: string) {
  const s = await getSettings(db);
  if (!s.guestEnabled) return null;
  const g = await db.guestSession.findUnique({ where: { tokenHash: sha256(token) }, include: { access: { select: { revokedAt: true } } } });
  if (!g || (g.expiresAt && g.expiresAt < new Date())) return null;
  if (g.accessId ? g.access?.revokedAt : !guestOpenNow(s)) return null;
  return { id: g.id };
}

/** Paths a guest may open. Everything else belongs to accounts. */
export const isGuestPath = (p: string) => /^\/($|woerter$|wort\/[^/]+$|zufall$|wort-des-jahres$|export(\/(druck|pruefen))?$)/.test(p);
