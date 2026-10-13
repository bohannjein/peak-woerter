import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { AiForm } from "./form";

export const metadata: Metadata = { title: "KI", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Ki() {
  const s = await getSettings(db);
  return (
    <div className="max-w-2xl">
      <p className="text-ink-2">
        OpenAI-kompatible Schnittstelle, z. B. Ollama: <code className="font-mono text-sm">http://ollama:11434/v1</code>. Nur Entwürfe.
      </p>
      <p className="mt-2 text-ink-2">
        <code className="font-mono text-sm">AI_API_KEY</code>: <strong>{process.env.AI_API_KEY ? "gesetzt" : "nicht gesetzt"}</strong>
      </p>
      <AiForm settings={{ aiProvider: s.aiProvider, aiBaseUrl: s.aiBaseUrl, aiModel: s.aiModel }} />
    </div>
  );
}
