import { db } from "@/lib/db";
import { getSettings, guestOpenNow } from "@/lib/settings";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function Anmelden({ searchParams }: { searchParams: Promise<{ gast?: string }> }) {
  const [s, sp] = await Promise.all([getSettings(db), searchParams]);
  return <LoginForm guestOpen={guestOpenNow(s)} guestInvalid={sp.gast === "ungueltig"} />;
}
