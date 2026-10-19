import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { FeatureForm, VotingForm } from "./forms";

export const metadata: Metadata = { title: "Abstimmung & Funktionen", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Einstellungen() {
  const s = await getSettings(db);
  return (
    <div className="max-w-2xl space-y-14">
      <section aria-labelledby="abst">
        <h2 id="abst" className="section-title">
          Abstimmung
        </h2>
        <VotingForm s={s} />
      </section>
      <section aria-labelledby="funk">
        <h2 id="funk" className="section-title">
          Funktionen
        </h2>
        <FeatureForm s={s} />
      </section>
    </div>
  );
}
