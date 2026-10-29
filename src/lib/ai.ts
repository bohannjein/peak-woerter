// Optional AI drafts for dictionary entries. The app works without it.
// AI output is stored as AiDraft and only ever applied by a curator.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Db } from "./db";
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
          { role: "user", content: userPrompt(input) },
        ],
      }),
    });
    if (!res.ok) throw new AppError(`KI-Anbieter antwortet mit Fehler ${res.status}.`, 502);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseSuggestion(body.choices?.[0]?.message?.content ?? "");
  }
}

function parseSuggestion(raw: string): Suggestion {
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

const userPrompt = (input: { term: string; context?: string | null; categories: string[] }) =>
  `Wort: ${input.term}\nKontext der Einreichung: ${input.context || "keiner"}\nVorhandene Kategorien: ${input.categories.join(", ") || "keine"}`;

class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";
  private client: Anthropic;
  constructor(baseUrl: string, readonly model: string, apiKey?: string) {
    this.client = anthropicClient(baseUrl, apiKey);
  }

  async suggest(input: { term: string; context?: string | null; categories: string[] }): Promise<Suggestion> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(input) }],
    });
    if (res.stop_reason === "refusal") throw new AppError("Die KI hat die Anfrage abgelehnt.", 502);
    const text = res.content.find((b) => b.type === "text");
    return parseSuggestion(text?.type === "text" ? text.text : "");
  }
}

const anthropicClient = (baseUrl: string, apiKey?: string) =>
  new Anthropic({ apiKey: apiKey ?? null, baseURL: baseUrl || undefined, timeout: 60_000, maxRetries: 1 });

export type AiKind = Exclude<Settings["aiProvider"], "none">;

/** Model ids offered by the provider, for the admin model picker. */
export async function listModels(kind: AiKind, baseUrl: string, apiKey?: string): Promise<string[]> {
  try {
    if (kind === "anthropic") {
      const ids: string[] = [];
      for await (const m of anthropicClient(baseUrl, apiKey).models.list()) ids.push(m.id);
      return ids;
    }
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new AppError(`Anbieter antwortet mit Fehler ${res.status}${res.status === 401 || res.status === 403 ? " (API-Schlüssel prüfen)" : ""}.`, 502);
    const body = (await res.json()) as { data?: { id?: string }[]; models?: { name?: string }[] };
    // OpenAI shape: data[].id. Gemini also answers with models[].name ("models/…").
    const ids = body.data?.map((m) => m.id) ?? body.models?.map((m) => m.name?.replace(/^models\//, ""));
    return (ids ?? []).filter((x): x is string => !!x).sort();
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AppError("API-Schlüssel wurde abgelehnt.", 502);
    throw new AppError("Anbieter nicht erreichbar. Adresse prüfen.", 502);
  }
}

// The API key lives outside Settings so it never reaches a client component or an export.
const KEY = "aiApiKey";
export async function getAiKey(db: Db): Promise<string> {
  const row = await db.appSetting.findUnique({ where: { key: KEY } });
  return typeof row?.value === "string" ? row.value : "";
}
export async function setAiKey(db: Db, value: string) {
  await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** Returns null when AI is not configured. Key: admin setting, else AI_API_KEY from the environment. */
export function getAiProvider(s: Pick<Settings, "aiProvider" | "aiBaseUrl" | "aiModel">, apiKey = ""): AiProvider | null {
  if (s.aiProvider === "none" || !s.aiModel) return null;
  const key = apiKey || process.env.AI_API_KEY || undefined;
  if (s.aiProvider === "anthropic") return new AnthropicProvider(s.aiBaseUrl, s.aiModel, key);
  if (!s.aiBaseUrl) return null;
  return new OpenAiCompatible(s.aiBaseUrl, s.aiModel, key);
}
