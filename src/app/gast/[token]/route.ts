import { db } from "@/lib/db";
import { redeemGuestLink } from "@/lib/guests";
import { guestRedirect } from "../session";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return guestRedirect(token.length <= 100 ? await redeemGuestLink(db, token) : null);
}
