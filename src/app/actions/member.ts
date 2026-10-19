"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { changeEmail, setFavorite, updateProfile } from "@/lib/profile";
import { AppError, safeAction } from "@/lib/errors";

const Id = z.string().min(1).max(64);

export async function setFavoriteAction(wordId: string | null) {
  return safeAction(async () => {
    const v = await requireMember();
    await setFavorite(db, v.id, wordId === null ? null : Id.parse(wordId));
    revalidatePath("/", "layout");
    return true;
  });
}

const Profile = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(60, "Der Name ist zu lang (max. 60 Zeichen)."),
  bio: z.string().trim().max(500, "Die Bio ist zu lang (max. 500 Zeichen)."),
});

export async function updateProfileAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireMember();
    const r = Profile.safeParse({ name: fd.get("name"), bio: fd.get("bio") ?? "" });
    if (!r.success) throw new AppError(r.error.issues[0].message);
    await updateProfile(db, v.id, r.data);
    revalidatePath("/", "layout");
    return true;
  });
}

const Email = z.object({
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben.").max(200),
  password: z.string().min(1, "Bitte das aktuelle Passwort eingeben.").max(256),
});

export async function changeEmailAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireMember();
    const r = Email.safeParse(Object.fromEntries(fd));
    if (!r.success) throw new AppError(r.error.issues[0].message);
    await changeEmail(db, { userId: v.id, ...r.data });
    revalidatePath("/konto");
    return true;
  });
}

export async function markNotificationsReadAction() {
  return safeAction(async () => {
    const v = await requireMember();
    await db.notification.updateMany({ where: { userId: v.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/", "layout");
    return true;
  });
}
