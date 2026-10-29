// Optional AI drafts for dictionary entries. The app works without it.
// AI output is stored as AiDraft and only ever applied by a curator.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Db } from "./db";
import type { Settings } from "./settings";
import { AppError } from "./errors";

// Models differ in how closely they follow the format (missing fields, "high"
// instead of "hoch", lists as null, overlong text). Normalise instead of rejecting.
const text = (max: number) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim().slice(0, max) || null : typeof v === "number" ? String(v) : null), z.string().nullable());
const list = (n: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.split(/[,;]/) : Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, max)).slice(0, n),
    z.array(z.string()),
  );
const oneOf = <T extends string>(values: readonly T[], aliases: Record<string, T> = {}) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return null;
    const k = v.trim().toLowerCase();
    return aliases[k] ?? values.find((x) => x.toLowerCase() === k) ?? null;
  }, z.enum(values as [T, ...T[]]).nullable());

const POS = ["SUBSTANTIV", "VERB", "ADJEKTIV", "ADVERB", "INTERJEKTION", "REDEWENDUNG", "SONSTIGES"] as const;
const CONFIDENCE = ["hoch", "mittel", "niedrig"] as const;
const confidence = oneOf(CONFIDENCE, { high: "hoch", medium: "mittel", low: "niedrig", mittelhoch: "mittel" });

export const Suggestion = z.object({
  shortDefinition: text(400),
  meaning: text(1500),
  partOfSpeech: oneOf(POS, { nomen: "SUBSTANTIV", noun: "SUBSTANTIV", verb: "VERB", adjective: "ADJEKTIV", adverb: "ADVERB", interjection: "INTERJEKTION", phrase: "REDEWENDUNG", idiom: "REDEWENDUNG" }),
  ipa: z.preprocess((v) => (typeof v === "string" ? v.trim().replace(/^[\[/]+|[\]/]+$/g, "").slice(0, 120) || null : null), z.string().nullable()),
  ipaConfidence: confidence,
  example: text(400),
  categories: list(5, 40),
  origin: text(600),
  originConfidence: confidence,
  variants: list(5, 120),
  caveats: text(600),
});
export type Suggestion = z.infer<typeof Suggestion>;

export type SuggestInput = {
  term: string;
  context?: string | null;
  categories: { name: string; keywords: string[] }[];
  /** The entry as saved so far, as plain text. */
  entry?: string | null;
  /** A few accepted entries as a style reference. */
  examples?: string[];
};

export interface AiProvider {
  readonly id: string;
  readonly model: string;
  suggest(input: SuggestInput): Promise<Suggestion>;
}

const SYSTEM = `Du hilfst einer kleinen Gruppe von Freunden, ein humorvolles deutsches Wörterbuch zu pflegen.
Antworte ausschließlich mit einem JSON-Objekt mit diesen Feldern:
shortDefinition (1–2 prägnante Sätze, darf trocken-humorvoll sein, muss aber verständlich erklären),
meaning (ausführlicher, optional), partOfSpeech (SUBSTANTIV|VERB|ADJEKTIV|ADVERB|INTERJEKTION|REDEWENDUNG|SONSTIGES),
ipa (IPA ohne Klammern), ipaConfidence (hoch|mittel|niedrig), example (alltäglicher Beispielsatz ohne Anführungszeichen),
categories (Namen, nur aus der gegebenen Liste), origin, originConfidence (hoch|mittel|niedrig), variants (andere Schreibweisen), caveats.
Regeln: Erfinde nichts. Wenn du ein Wort nicht kennst (Fantasiewort, Insider), setze Felder auf null und erkläre das in caveats.
Bei unsicherer Aussprache ipaConfidence "niedrig". Herkunft nur mit begründeter Annahme, sonst null.
Gibt es schon einen Eintrag, ergänze, was fehlt, und verbessere Unklares. Wiederhole Vorhandenes nicht; setze solche Felder auf null.
Übernimm Ton und Länge der Beispieleinträge, nicht ihren Inhalt.`;

const nullable = (type: string, extra: object = {}) => ({ type: [type, "null"], ...extra });
// Same fields as Suggestion, for providers that can enforce a JSON schema.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shortDefinition", "meaning", "partOfSpeech", "ipa", "ipaConfidence", "example", "categories", "origin", "originConfidence", "variants", "caveats"],
  properties: {
    shortDefinition: nullable("string"),
    meaning: nullable("string"),
    partOfSpeech: nullable("string", { enum: [...POS, null] }),
    ipa: nullable("string"),
    ipaConfidence: nullable("string", { enum: [...CONFIDENCE, null] }),
    example: nullable("string"),
    categories: { type: "array", items: { type: "string" } },
    origin: nullable("string"),
    originConfidence: nullable("string", { enum: [...CONFIDENCE, null] }),
    variants: { type: "array", items: { type: "string" } },
    caveats: nullable("string"),
  },
};

class OpenAiCompatible implements AiProvider {
  readonly id = "openai-compatible";
  constructor(private baseUrl: string, readonly model: string, private apiKey?: string) {}

  private request(input: SuggestInput, strict: boolean) {
    return fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        response_format: strict ? { type: "json_schema", json_schema: { name: "eintrag", strict: true, schema: SCHEMA } } : { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt(input) },
        ],
      }),
    });
  }

  async suggest(input: SuggestInput): Promise<Suggestion> {
    let res = await this.request(input, true);
    // Not every provider/model supports json_schema (e.g. DeepSeek): fall back to plain JSON mode.
    if (res.status === 400 || res.status === 422) res = await this.request(input, false);
    if (!res.ok) throw new AppError(`KI-Anbieter antwortet mit Fehler ${res.status}.`, 502);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseSuggestion(body.choices?.[0]?.message?.content ?? "");
  }
}

export function parseSuggestion(raw: string): Suggestion {
  // Some models add prose or code fences around the object.
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    console.error("AI: kein JSON", raw.slice(0, 500));
    throw new AppError("Die KI hat kein gültiges JSON geliefert.", 502);
  }
  // Unwrap {"Mumpitz": {...}} or {"result": {...}}.
  if (parsed && typeof parsed === "object" && !("shortDefinition" in parsed)) {
    const inner = Object.values(parsed).find((v) => v && typeof v === "object" && !Array.isArray(v) && "shortDefinition" in v);
    if (inner) parsed = inner;
  }
  const r = Suggestion.safeParse(parsed);
  if (!r.success) {
    console.error("AI: unerwartetes Format", r.error.issues, raw.slice(0, 500));
    throw new AppError("Die KI-Antwort hatte ein unerwartetes Format.", 502);
  }
  return r.data;
}

export function userPrompt(input: SuggestInput) {
  const cats = input.categories.map((c) => (c.keywords.length ? `${c.name} (Stichwörter: ${c.keywords.slice(0, 8).join(", ")})` : c.name));
  return [
    `Wort: ${input.term}`,
    `Kontext der Einreichung: ${input.context || "keiner"}`,
    `Bisheriger Eintrag:\n${input.entry || "noch leer"}`,
    `Vorhandene Kategorien: ${cats.join("; ") || "keine"}`,
    input.examples?.length ? `So klingen aufgenommene Einträge:\n${input.examples.map((e) => `- ${e}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

class AnthropicProvider implements AiProvider {
  readonly id = "anthropic";
  private client: Anthropic;
  constructor(baseUrl: string, readonly model: string, apiKey?: string) {
    this.client = anthropicClient(baseUrl, apiKey);
  }

  private request(input: SuggestInput, strict: boolean) {
    return this.client.messages.create({
      model: this.model,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(input) }],
      ...(strict ? { output_config: { format: { type: "json_schema" as const, schema: SCHEMA } } } : {}),
    });
  }

  async suggest(input: SuggestInput): Promise<Suggestion> {
    let res;
    try {
      res = await this.request(input, true);
    } catch (e) {
      // Older models without structured outputs: plain request, the parser copes.
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      res = await this.request(input, false);
    }
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
