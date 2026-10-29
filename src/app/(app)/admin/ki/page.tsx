import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getAiKey } from "@/lib/ai";
import { AiForm } from "./form";

export const metadata: Metadata = { title: "KI", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Ki() {
  const [s, key] = await Promise.all([getSettings(db), getAiKey(db)]);
  return (
    <div className="max-w-2xl">
      <p className="text-ink-2">Anbieter wählen, Schlüssel eintragen, Modelle laden und eins auswählen. Die KI schreibt nur Entwürfe.</p>
      {!key && process.env.AI_API_KEY && (
        <p className="mt-2 text-ink-2">
          Ohne eigenen Schlüssel gilt <code className="font-mono text-sm">AI_API_KEY</code> aus der Server-Umgebung.
        </p>
      )}
      <AiForm settings={{ aiProvider: s.aiProvider, aiBaseUrl: s.aiBaseUrl, aiModel: s.aiModel }} hasKey={!!key} />
    </div>
  );
}
