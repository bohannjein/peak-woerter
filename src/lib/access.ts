import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { db } from "./db";
import { getSettings } from "./settings";
import { policyGaps, type Gap } from "./policy";
import { AppError } from "./errors";
import { can, type Permission } from "./permissions";
import { GUEST_COOKIE, guestSession } from "./guests";

export type Viewer = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  seat: number | null;
  permissions: string[];
  has2fa: boolean;
  passkeys: number;
  /** Missing security requirements; empty = policy satisfied. */
  missing: Gap[];
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { curatorSeat: true, _count: { select: { passkeys: true } } },
  });
  if (!user || user.disabled) return null;
  const settings = await getSettings(db);
  const v = { has2fa: !!user.twoFactorEnabled, passkeys: user._count.passkeys };
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    seat: user.curatorSeat?.seat ?? null,
    permissions: user.permissions,
    ...v,
    missing: policyGaps(settings, v),
  };
});

/** Guest identity from the guest cookie, only while guest mode allows it. */
export const getGuest = cache(async () => {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  return token ? guestSession(db, token) : null;
});

const SECURITY_PAGE = "/konto?pflicht=1";

/** Pages: curator or admin, policy satisfied. */
export async function requireStaffPage(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/anmelden");
  if (v.missing.length) redirect(SECURITY_PAGE);
  if (!v.seat && !v.isAdmin) redirect("/");
  return v;
}

/** Pages: any account with the given right (curators and admins have all). */
export async function requirePermissionPage(p: Permission): Promise<Viewer> {
  const v = await requireMemberPage();
  if (!can(v, p)) redirect("/");
  return v;
}

export async function requireMemberPage(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/anmelden");
  if (v.missing.length) redirect(SECURITY_PAGE);
  return v;
}

export async function requireAdminPage(): Promise<Viewer> {
  const v = await requireStaffPage();
  if (!v.isAdmin) redirect("/k");
  return v;
}

/** Server actions: throw instead of redirect. */
export async function requireMember(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new AppError("Bitte melde dich an.", 401);
  if (v.missing.length) throw new AppError("Zuerst Pflicht-Sicherheit einrichten.", 403);
  return v;
}

export async function requireStaff(): Promise<Viewer> {
  const v = await requireMember();
  if (!v.seat && !v.isAdmin) throw new AppError("Keine Berechtigung.", 403);
  return v;
}

export async function requirePermission(p: Permission): Promise<Viewer> {
  const v = await requireMember();
  if (!can(v, p)) throw new AppError("Keine Berechtigung.", 403);
  return v;
}

export async function requireCurator(): Promise<Viewer & { seat: number }> {
  const v = await requireStaff();
  if (!v.seat) throw new AppError("Nur Kuratoren dürfen das.", 403);
  return v as Viewer & { seat: number };
}

export async function requireAdmin(): Promise<Viewer> {
  const v = await requireStaff();
  if (!v.isAdmin) throw new AppError("Nur für Administratoren.", 403);
  return v;
}
