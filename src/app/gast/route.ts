import { db } from "@/lib/db";
import { openGuestSession } from "@/lib/guests";
import { guestRedirect } from "./session";

export const dynamic = "force-dynamic";

// Open guest mode: every browser gets its own guest identity on first visit.
export async function GET(req: Request) {
  const to = new URL(req.url).searchParams.get("weiter") ?? "/";
  return guestRedirect(await openGuestSession(db), to.startsWith("/") && !to.startsWith("//") ? to : "/");
}
