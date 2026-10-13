import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PoliciesForm } from "./form";

export const metadata: Metadata = { title: "Richtlinien", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Sicherheit() {
  const s = await getSettings(db);
  return (
    <div className="max-w-2xl">
      <PoliciesForm settings={s} />
    </div>
  );
}
