import { NextResponse } from "next/server";
import { GUEST_COOKIE } from "@/lib/guests";
import { siteUrl } from "@/lib/url";

/** Sets the guest cookie and sends the guest to the collection. */
export function guestRedirect(s: { token: string; expiresAt: Date | null } | null, to = "/") {
  if (!s) return NextResponse.redirect(`${siteUrl()}/anmelden?gast=ungueltig`, 303);
  const res = NextResponse.redirect(`${siteUrl()}${to}`, 303);
  res.cookies.set(GUEST_COOKIE, s.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: siteUrl().startsWith("https:"),
    path: "/",
    expires: s.expiresAt ?? new Date(Date.now() + 365 * 24 * 3600_000),
  });
  return res;
}
