// Account creation outside of Better Auth's (disabled) sign-up endpoint:
// setup wizard, invitations, admin-issued password resets.
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Db, Tx } from "./db";
import { AppError } from "./errors";
import { audit } from "./audit";
import { getSettings, setSettings } from "./settings";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

export function validatePassword(pw: string) {
  if (pw.length < 12) throw new AppError("Das Passwort braucht mindestens 12 Zeichen.");
  if (pw.length > 256) throw new AppError("Das Passwort ist zu lang.");
  if (new Set(pw).size < 5) throw new AppError("Das Passwort ist zu einfach.");
}

async function createUser(tx: Tx, input: { name: string; email: string; password: string; isAdmin?: boolean }) {
  validatePassword(input.password);
  const email = input.email.trim().toLowerCase();
  if (await tx.user.findUnique({ where: { email } })) throw new AppError("Diese E-Mail-Adresse wird schon verwendet.", 409);
  const id = randomUUID();
  const user = await tx.user.create({ data: { id, name: input.name.trim(), email, isAdmin: !!input.isAdmin } });
  // Same shape Better Auth writes for credential accounts.
  await tx.account.create({
    data: { id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: await hashPassword(input.password) },
  });
  return user;
}

export const seatNumbers = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

async function checkSeat(db: Db | Tx, seat: number) {
  const { voterCount } = await getSettings(db);
  if (!Number.isInteger(seat) || seat < 1 || seat > voterCount) throw new AppError("Ungültiger Platz.");
}

export async function assignSeat(tx: Db | Tx, userId: string, seat: number) {
  await checkSeat(tx, seat);
  if (await tx.curatorSeat.findUnique({ where: { userId } })) throw new AppError("Dieses Konto hat schon einen Platz.");
  const taken = await tx.curatorSeat.findUnique({ where: { seat } });
  if (taken) throw new AppError(`Kuratorenplatz ${seat} ist schon vergeben.`, 409);
  await tx.curatorSeat.create({ data: { seat, userId } });
}

export async function freeSeat(db: Db): Promise<number | null> {
  const [seats, s] = await Promise.all([db.curatorSeat.findMany({ select: { seat: true } }), getSettings(db)]);
  return seatNumbers(s.voterCount).find((s) => !seats.some((x) => x.seat === s)) ?? null;
}

// ───────────── Setup token ─────────────

/**
 * Returns true if a token was freshly generated (and printed to the server log).
 * SETUP_TOKEN from the environment takes precedence.
 */
export async function ensureSetupToken(db: Db): Promise<void> {
  const s = await getSettings(db);
  if (s.setupCompleted || s.setupTokenHash || process.env.SETUP_TOKEN) return;
  const token = newToken().slice(0, 24);
  await setSettings(db, { setupTokenHash: sha256(token) });
  console.log(`\n┌─ Peake Wörter Ersteinrichtung ─────────────────────────\n│ Setup-Token: ${token}\n│ Öffne /einrichtung und gib dieses Token ein.\n└────────────────────────────────────────────────────────\n`);
}

export async function checkSetupToken(db: Db, token: string): Promise<boolean> {
  const env = process.env.SETUP_TOKEN;
  const expected = env ? sha256(env) : (await getSettings(db)).setupTokenHash;
  if (!expected || !token) return false;
  const a = Buffer.from(sha256(token.trim()));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createInitialAdmin(db: Db, input: { token: string; name: string; email: string; password: string; asCurator: boolean }) {
  return db.$transaction(async (tx) => {
    // Lock settings row to serialise concurrent setup attempts.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(777001)`;
    const s = await getSettings(tx);
    if (s.setupCompleted || (await tx.user.count({ where: { isAdmin: true } })) > 0) {
      throw new AppError("Die Ersteinrichtung ist bereits erfolgt.", 403);
    }
    if (!(await checkSetupToken(db, input.token))) throw new AppError("Setup-Token ist ungültig.", 403);
    const user = await createUser(tx, { ...input, isAdmin: true });
    if (input.asCurator) await assignSeat(tx, user.id, 1);
    await setSettings(tx, { setupTokenHash: null });
    await audit(tx, user.id, "setup.admin_created", "user", user.id);
    return user;
  });
}

// ───────────── Invitations & resets ─────────────

const DAY = 24 * 60 * 60 * 1000;

export async function createInvite(db: Db, input: { createdById: string; email?: string | null; grantAdmin: boolean; grantSeat: number | null }) {
  if (input.grantSeat) {
    await checkSeat(db, input.grantSeat);
    const seat = await db.curatorSeat.findUnique({ where: { seat: input.grantSeat } });
    if (seat) throw new AppError(`Kuratorenplatz ${input.grantSeat} ist schon vergeben.`, 409);
  }
  const token = newToken();
  await db.accessLink.create({
    data: {
      kind: "INVITE",
      tokenHash: sha256(token),
      email: input.email?.trim().toLowerCase() || null,
      grantAdmin: input.grantAdmin,
      grantSeat: input.grantSeat,
      expiresAt: new Date(Date.now() + 7 * DAY),
      createdById: input.createdById,
    },
  });
  await audit(db, input.createdById, "invite.created", "access_link", null, { grantSeat: input.grantSeat, grantAdmin: input.grantAdmin });
  return token;
}

async function useLink(tx: Tx, token: string, kind: "INVITE" | "RESET") {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM access_link WHERE "tokenHash" = ${sha256(token)} AND kind = ${kind}::"AccessLinkKind"
      AND "usedAt" IS NULL AND "expiresAt" > now() FOR UPDATE`;
  if (!rows[0]) throw new AppError("Der Link ist ungültig oder abgelaufen.", 410);
  return tx.accessLink.update({ where: { id: rows[0].id }, data: { usedAt: new Date() } });
}

export async function peekLink(db: Db, token: string, kind: "INVITE" | "RESET") {
  const link = await db.accessLink.findUnique({ where: { tokenHash: sha256(token) } });
  if (!link || link.kind !== kind || link.usedAt || link.expiresAt < new Date()) return null;
  return link;
}

export async function acceptInvite(db: Db, input: { token: string; name: string; email: string; password: string }) {
  return db.$transaction(async (tx) => {
    const link = await useLink(tx, input.token, "INVITE");
    if (link.email && link.email !== input.email.trim().toLowerCase()) {
      throw new AppError("Diese Einladung gilt für eine andere E-Mail-Adresse.", 403);
    }
    const user = await createUser(tx, { ...input, isAdmin: link.grantAdmin });
    if (link.grantSeat) await assignSeat(tx, user.id, link.grantSeat);
    await audit(tx, user.id, "invite.accepted", "user", user.id, { seat: link.grantSeat, admin: link.grantAdmin });
    return user;
  });
}

export async function createResetLink(db: Db, input: { createdById: string | null; userId: string }) {
  const token = newToken();
  await db.accessLink.create({
    data: { kind: "RESET", tokenHash: sha256(token), userId: input.userId, expiresAt: new Date(Date.now() + DAY), createdById: input.createdById },
  });
  await audit(db, input.createdById, "reset.created", "user", input.userId);
  return token;
}

/**
 * Sets a new password. Second factors stay untouched: if the account has TOTP
 * enabled it is still required at the next login, and the admin policy gate
 * still applies.
 */
export async function resetPassword(db: Db, input: { token: string; password: string }) {
  validatePassword(input.password);
  const hash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    const link = await useLink(tx, input.token, "RESET");
    if (!link.userId) throw new AppError("Der Link ist ungültig.", 410);
    const acc = await tx.account.findFirst({ where: { userId: link.userId, providerId: "credential" } });
    if (acc) await tx.account.update({ where: { id: acc.id }, data: { password: hash } });
    else await tx.account.create({ data: { id: randomUUID(), accountId: link.userId, providerId: "credential", userId: link.userId, password: hash } });
    await tx.session.deleteMany({ where: { userId: link.userId } });
    await audit(tx, link.userId, "reset.used", "user", link.userId);
  });
}

/** Admin: remove TOTP and backup codes (lost device). Policy then forces re-enrolment. */
export async function resetSecondFactor(db: Db, input: { adminId: string; userId: string }) {
  await db.$transaction(async (tx) => {
    await tx.twoFactor.deleteMany({ where: { userId: input.userId } });
    await tx.user.update({ where: { id: input.userId }, data: { twoFactorEnabled: false } });
    await tx.session.deleteMany({ where: { userId: input.userId } });
    await audit(tx, input.adminId, "user.2fa_reset", "user", input.userId);
  });
}
