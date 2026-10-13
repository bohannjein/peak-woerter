"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/access";
import { createInvite, createResetLink, resetSecondFactor } from "@/lib/accounts";
import { setSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { AppError, safeAction } from "@/lib/errors";
import { siteUrl } from "@/lib/url";

const refresh = () => revalidatePath("/admin", "layout");

export async function inviteAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const seatRaw = String(fd.get("seat") ?? "");
    const grantSeat = seatRaw === "1" || seatRaw === "2" ? Number(seatRaw) : null;
    const email = String(fd.get("email") ?? "").trim() || null;
    if (email && !z.string().email().safeParse(email).success) throw new AppError("Ungültige E-Mail-Adresse.");
    const grantAdmin = fd.get("admin") === "on";
    // Neither seat nor admin = member with read access (no vote).
    const token = await createInvite(db, { createdById: v.id, email, grantAdmin, grantSeat });
    refresh();
    return { link: `${siteUrl()}/einladung/${token}` };
  });
}

export async function revokeInviteAction(id: string) {
  return safeAction(async () => {
    const v = await requireAdmin();
    await db.accessLink.update({ where: { id, usedAt: null }, data: { expiresAt: new Date() } });
    await audit(db, v.id, "invite.revoked", "access_link", id);
    refresh();
    return true;
  });
}

export async function resetLinkAction(userId: string) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const token = await createResetLink(db, { createdById: v.id, userId });
    return { link: `${siteUrl()}/zuruecksetzen/${token}` };
  });
}

export async function reset2faAction(userId: string) {
  return safeAction(async () => {
    const v = await requireAdmin();
    await resetSecondFactor(db, { adminId: v.id, userId });
    refresh();
    return true;
  });
}

export async function setDisabledAction(userId: string, disabled: boolean) {
  return safeAction(async () => {
    const v = await requireAdmin();
    if (userId === v.id) throw new AppError("Du kannst dich nicht selbst sperren.");
    await db.$transaction([
      db.user.update({ where: { id: userId }, data: { disabled } }),
      db.session.deleteMany({ where: { userId } }),
    ]);
    await audit(db, v.id, disabled ? "user.disabled" : "user.enabled", "user", userId);
    refresh();
    return true;
  });
}

export async function setAdminAction(userId: string, isAdmin: boolean) {
  return safeAction(async () => {
    const v = await requireAdmin();
    if (!isAdmin && (await db.user.count({ where: { isAdmin: true, disabled: false } })) <= 1) {
      throw new AppError("Es muss mindestens einen aktiven Administrator geben.");
    }
    await db.user.update({ where: { id: userId }, data: { isAdmin } });
    await audit(db, v.id, isAdmin ? "user.admin_granted" : "user.admin_revoked", "user", userId);
    refresh();
    return true;
  });
}

/** Frees a curator seat. Votes stay in the history; open rounds wait for the new curator. */
export async function freeSeatAction(seat: number) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const s = await db.curatorSeat.findUnique({ where: { seat } });
    if (!s) throw new AppError("Platz ist schon frei.");
    await db.curatorSeat.delete({ where: { seat } });
    await audit(db, v.id, "seat.freed", "user", s.userId, { seat });
    refresh();
    return true;
  });
}

export async function assignSeatAction(userId: string, seat: number) {
  return safeAction(async () => {
    const v = await requireAdmin();
    if (seat !== 1 && seat !== 2) throw new AppError("Ungültiger Platz.");
    if (await db.curatorSeat.findUnique({ where: { seat } })) throw new AppError(`Platz ${seat} ist belegt.`);
    if (await db.curatorSeat.findUnique({ where: { userId } })) throw new AppError("Dieses Konto hat schon einen Platz.");
    await db.curatorSeat.create({ data: { seat, userId } });
    await audit(db, v.id, "seat.assigned", "user", userId, { seat });
    refresh();
    return true;
  });
}

const Ai = z.object({
  aiProvider: z.enum(["none", "openai-compatible"]),
  aiBaseUrl: z.string().trim().max(300).refine((s) => s === "" || /^https?:\/\//.test(s), "Die Adresse muss mit http:// oder https:// beginnen."),
  aiModel: z.string().trim().max(120),
});

export async function aiSettingsAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const r = Ai.safeParse(Object.fromEntries(fd));
    if (!r.success) throw new AppError(r.error.issues[0].message);
    if (r.data.aiProvider !== "none" && (!r.data.aiBaseUrl || !r.data.aiModel)) throw new AppError("Adresse und Modell sind nötig.");
    await setSettings(db, r.data);
    await audit(db, v.id, "settings.ai", "app", null, r.data);
    refresh();
    return true;
  });
}
