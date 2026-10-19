"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/access";
import { assignSeat, createInvite, createResetLink, resetSecondFactor } from "@/lib/accounts";
import { setSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { AppError, safeAction } from "@/lib/errors";
import { siteUrl } from "@/lib/url";
import { settleRounds } from "@/lib/voting";
import { createGuestLink } from "@/lib/guests";
import { fromBerlinLocal } from "@/lib/time";
import { PERMISSION_KEYS } from "@/lib/permissions";

const refresh = () => revalidatePath("/admin", "layout");

export async function inviteAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const seatRaw = String(fd.get("seat") ?? "");
    const grantSeat = seatRaw ? Number(seatRaw) : null;
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
    await assignSeat(db, userId, seat);
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

// ───────── Voting, features, guests, permissions ─────────

const Voting = z.object({
  voterCount: z.coerce.number().int().min(2, "Mindestens 2 Voter.").max(20, "Höchstens 20 Voter."),
  voteRule: z.enum(["majority", "unanimous"]),
  voteDeadlineHours: z.coerce.number().int().min(0).max(24 * 365),
});

export async function votingSettingsAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const r = Voting.safeParse(Object.fromEntries(fd));
    if (!r.success) throw new AppError(r.error.issues[0].message);
    const highest = await db.curatorSeat.aggregate({ _max: { seat: true } });
    if ((highest._max.seat ?? 0) > r.data.voterCount) {
      throw new AppError(`Platz ${highest._max.seat} ist noch belegt. Erst Plätze über ${r.data.voterCount} freigeben.`);
    }
    await setSettings(db, r.data);
    await audit(db, v.id, "settings.voting", "app", null, r.data);
    // Fewer voters can make open rounds decidable right away.
    await settleRounds(db);
    revalidatePath("/", "layout");
    return true;
  });
}

export async function featureSettingsAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const s = { gameVoice: fd.get("gameVoice") === "on", autoTag: fd.get("autoTag") === "on" };
    await setSettings(db, s);
    await audit(db, v.id, "settings.features", "app", null, s);
    refresh();
    return true;
  });
}

const GuestMode = z.object({
  guestEnabled: z.boolean(),
  open: z.enum(["aus", "bis", "immer"]),
  until: z.string().max(20).optional(),
});

export async function guestSettingsAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const r = GuestMode.safeParse({ guestEnabled: fd.get("guestEnabled") === "on", open: fd.get("open"), until: fd.get("until") || undefined });
    if (!r.success) throw new AppError("Ungültige Angaben.");
    let guestOpenUntil = "";
    if (r.data.open === "immer") guestOpenUntil = "immer";
    if (r.data.open === "bis") {
      if (!r.data.until || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.data.until)) throw new AppError("Bitte ein Enddatum angeben.");
      const until = fromBerlinLocal(r.data.until);
      if (until <= new Date()) throw new AppError("Das Enddatum liegt in der Vergangenheit.");
      guestOpenUntil = until.toISOString();
    }
    await setSettings(db, { guestEnabled: r.data.guestEnabled, guestOpenUntil });
    await audit(db, v.id, "settings.guests", "app", null, { guestEnabled: r.data.guestEnabled, guestOpenUntil });
    revalidatePath("/", "layout");
    return true;
  });
}

const GuestLink = z.object({
  label: z.string().trim().max(60),
  kind: z.enum(["einmalig", "zeitlich"]),
  hours: z.coerce.number().int().min(1).max(24 * 90),
});

export async function guestLinkAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const r = GuestLink.safeParse(Object.fromEntries(fd));
    if (!r.success) throw new AppError("Ungültige Angaben (Gültigkeit 1 Stunde bis 90 Tage).");
    const token = await createGuestLink(db, { createdById: v.id, label: r.data.label || null, singleUse: r.data.kind === "einmalig", hours: r.data.hours });
    refresh();
    return { link: `${siteUrl()}/gast/${token}` };
  });
}

export async function revokeGuestLinkAction(id: string) {
  return safeAction(async () => {
    const v = await requireAdmin();
    await db.guestAccess.update({ where: { id }, data: { revokedAt: new Date() } });
    await audit(db, v.id, "guest.link_revoked", "guest_access", id);
    refresh();
    return true;
  });
}

/** Ends every guest session at once (e.g. after sharing a link by mistake). */
export async function endGuestSessionsAction() {
  return safeAction(async () => {
    const v = await requireAdmin();
    const r = await db.guestSession.deleteMany({});
    await audit(db, v.id, "guest.sessions_ended", "app", null, { count: r.count });
    refresh();
    return true;
  });
}

export async function setPermissionsAction(userId: string, _: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const permissions = PERMISSION_KEYS.filter((p) => fd.get(p) === "on");
    await db.user.update({ where: { id: userId }, data: { permissions } });
    await audit(db, v.id, "user.permissions", "user", userId, { permissions });
    refresh();
    return true;
  });
}
