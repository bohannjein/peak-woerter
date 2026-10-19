import { verifyPassword } from "better-auth/crypto";
import type { Db } from "./db";
import { AppError } from "./errors";
import { audit } from "./audit";

export async function updateProfile(db: Db, userId: string, input: { name: string; bio: string | null }) {
  await db.user.update({ where: { id: userId }, data: { name: input.name.trim(), bio: input.bio?.trim() || null } });
  await audit(db, userId, "profile.updated", "user", userId);
}

/** Login e-mail change. Needs the current password, so a stolen session alone cannot take over the account. */
export async function changeEmail(db: Db, input: { userId: string; password: string; email: string }) {
  const email = input.email.trim().toLowerCase();
  const acc = await db.account.findFirst({ where: { userId: input.userId, providerId: "credential" } });
  if (!acc?.password || !(await verifyPassword({ hash: acc.password, password: input.password }))) {
    throw new AppError("Das Passwort stimmt nicht.", 403);
  }
  const taken = await db.user.findUnique({ where: { email } });
  if (taken && taken.id !== input.userId) throw new AppError("Diese E-Mail-Adresse wird schon verwendet.", 409);
  await db.user.update({ where: { id: input.userId }, data: { email } });
  await audit(db, input.userId, "profile.email_changed", "user", input.userId);
}

/** Only words from the collection can be a favourite. null clears it. */
export async function setFavorite(db: Db, userId: string, wordId: string | null) {
  if (wordId && !(await db.word.findFirst({ where: { id: wordId, isPublic: true }, select: { id: true } }))) {
    throw new AppError("Wort nicht gefunden.", 404);
  }
  await db.user.update({ where: { id: userId }, data: { favoriteWordId: wordId } });
}

/** Detects the image type from the file's first bytes; the browser's claim is not trusted. */
export function imageType(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  return null;
}
