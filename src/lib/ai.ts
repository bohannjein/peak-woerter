// Optional AI drafts for dictionary entries. The app works without it.
// AI output is stored as AiDraft and only ever applied by a curator.
import { z } from "zod";
import type { Settings } from "./settings";
import { AppError } from "./errors";

export const Suggestion = z.object({
  shortDefinition: z.string().max(400).nullable(),
  meaning: z.string().max(1500).nullable(),
  partOfSpeech: z.enum(["SUBSTANTIV", "VERB", "ADJEKTIV", "ADVERB", "INTERJEKTION", "REDEWENDUNG", "SONSTIGES"]).nullable(),
  ipa: z.string().max(120).nullable(),
  ipaConfidence: z.enum(["hoch", "mittel", "niedrig"]).nullable(),
  example: z.string().max(400).nullable(),
  categories: z.array(z.string().max(40)).max(5),
  origin: z.string().max(600).nullable(),
  originConfidence: z.enum(["hoch", "mittel", "niedrig"]).nullable(),
  variants: z.array(z.string().max(120)).max(5),
  caveats: z.string().max(600).nullable(),
});
export type Suggestion = z.infer<typeof Suggestion>;

export interface AiProvider {
  readonly id: string;
  readonly model: string;
  suggest(input: { term: string; context?: string | null; categories: string[] }): Promise<Suggestion>;
}

const SYSTEM = `Du hilfst zwei Freunden, ein humorvolles deutsches Wörterbuch zu pflegen.
Antworte ausschließlich mit einem JSON-Objekt mit diesen Feldern:
shortDefinition (1–2 prägnante Sätze, darf trocken-humorvoll sein, muss aber verständlich erklären),
meaning (ausführlicher, optional), partOfSpeech (SUBSTANTIV|VERB|ADJEKTIV|ADVERB|INTERJEKTION|REDEWENDUNG|SONSTIGES),
ipa (IPA ohne Klammern), ipaConfidence (hoch|mittel|niedrig), example (alltäglicher Beispielsatz ohne Anführungszeichen),
categories (Namen, bevorzugt aus der gegebenen Liste), origin, originConfidence (hoch|mittel|niedrig), variants (andere Schreibweisen), caveats.
Regeln: Erfinde nichts. Wenn du ein Wort nicht kennst (Fantasiewort, Insider), setze Felder auf null und erkläre das in caveats.
Bei unsicherer Aussprache ipaConfidence "niedrig". Herkunft nur mit begründeter Annahme, sonst null.`;

class OpenAiCompatible implements AiProvider {
  readonly id = "openai-compatible";
  constructor(private baseUrl: string, readonly model: string, private apiKey?: string) {}

  async suggest(input: { term: string; context?: string | null; categories: string[] }): Promise<Suggestion> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Wort: ${input.term}\nKontext der Einreichung: ${input.context || "keiner"}\nVorhandene Kategorien: ${input.categories.join(", ") || "keine"}`,
          },
        ],
      }),
    });
    if (!res.ok) throw new AppError(`KI-Anbieter antwortet mit Fehler ${res.status}.`, 502);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
    } catch {
      throw new AppError("Die KI hat kein gültiges JSON geliefert.", 502);
    }
    const r = Suggestion.safeParse({ categories: [], variants: [], ...(parsed as object) });
    if (!r.success) throw new AppError("Die KI-Antwort hatte ein unerwartetes Format.", 502);
    return r.data;
  }
}

/** Returns null when AI is not configured. API key comes only from the environment. */
export function getAiProvider(s: Pick<Settings, "aiProvider" | "aiBaseUrl" | "aiModel">): AiProvider | null {
  if (s.aiProvider !== "openai-compatible" || !s.aiBaseUrl || !s.aiModel) return null;
  return new OpenAiCompatible(s.aiBaseUrl, s.aiModel, process.env.AI_API_KEY || undefined);
}
