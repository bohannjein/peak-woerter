"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { acceptInvite, createInitialAdmin, createInvite, freeSeat, resetPassword } from "@/lib/accounts";
import { getSettings, setSettings } from "@/lib/settings";
import { getViewer, requireAdmin } from "@/lib/access";
import { audit } from "@/lib/audit";
import { AppError, safeAction } from "@/lib/errors";
import { siteUrl } from "@/lib/url";

const Name = z.string().trim().min(1, "Bitte einen Namen angeben.").max(60);
const Email = z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben.").max(200);
const Password = z.string().min(12, "Das Passwort braucht mindestens 12 Zeichen.").max(256);

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(r.error.issues[0]?.message ?? "Ungültige Eingabe.");
  return r.data;
}

async function signIn(email: string, password: string) {
  // nextCookies() plugin writes the session cookie for this server action.
  await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
}

export async function setupCreateAdminAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const input = parse(
      z.object({ token: z.string().min(1, "Bitte das Setup-Token eingeben."), name: Name, email: Email, password: Password, password2: z.string(), asCurator: z.boolean() })
        .refine((d) => d.password === d.password2, { message: "Die Passwörter stimmen nicht überein." }),
      { ...Object.fromEntries(fd), asCurator: fd.get("asCurator") === "on" },
    );
    await createInitialAdmin(db, input);
    await signIn(input.email, input.password);
    return true;
  });
}

async function requireSetupAdmin() {
  const v = await getViewer();
  const s = await getSettings(db);
  if (s.setupCompleted) throw new AppError("Die Einrichtung ist abgeschlossen.", 403);
  if (!v?.isAdmin) throw new AppError("Bitte als Administrator anmelden.", 401);
  return v;
}

export async function setupInviteAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireSetupAdmin();
    const seat = await freeSeat(db);
    if (!seat) throw new AppError("Alle Kuratorenplätze sind schon vergeben.");
    const email = fd.get("email") ? parse(Email, fd.get("email")) : null;
    const token = await createInvite(db, { createdById: v.id, email, grantAdmin: false, grantSeat: seat });
    return { link: `${siteUrl()}/einladung/${token}`, seat };
  });
}

const PolicyForm = z.object({
  require2fa: z.boolean(),
  requirePasskey: z.boolean(),
});
const boolsFrom = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, fd.get(k) === "on"]));

export async function setupSettingsAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireSetupAdmin();
    const s = parse(PolicyForm, boolsFrom(fd, ["require2fa", "requirePasskey"]));
    await setSettings(db, s);
    await audit(db, v.id, "settings.updated", "app", null, s);
    return true;
  });
}

export async function setupFinishAction() {
  return safeAction(async () => {
    const v = await requireSetupAdmin();
    await setSettings(db, { setupCompleted: true, setupTokenHash: null });
    await audit(db, v.id, "setup.completed", "app", null);
    revalidatePath("/", "layout");
    return true;
  });
}

export async function acceptInviteAction(token: string, _: unknown, fd: FormData) {
  return safeAction(async () => {
    const input = parse(
      z.object({ name: Name, email: Email, password: Password, password2: z.string() }).refine((d) => d.password === d.password2, {
        message: "Die Passwörter stimmen nicht überein.",
      }),
      Object.fromEntries(fd),
    );
    await acceptInvite(db, { token, ...input });
    await signIn(input.email, input.password);
    return true;
  });
}

export async function resetPasswordAction(token: string, _: unknown, fd: FormData) {
  return safeAction(async () => {
    const input = parse(
      z.object({ password: Password, password2: z.string() }).refine((d) => d.password === d.password2, { message: "Die Passwörter stimmen nicht überein." }),
      Object.fromEntries(fd),
    );
    await resetPassword(db, { token, password: input.password });
    return true;
  });
}

export async function updatePoliciesAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const s = parse(PolicyForm, boolsFrom(fd, ["require2fa", "requirePasskey"]));
    await setSettings(db, s);
    await audit(db, v.id, "settings.updated", "app", null, s);
    revalidatePath("/", "layout");
    return true;
  });
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
}
