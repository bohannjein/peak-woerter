// Admin export/import: settings and the whole word archive (all statuses), as one
// JSON file. No accounts, votes, comments or audio files. Import only adds: words
// that already exist (same normalized term) are skipped, never overwritten.
import { z } from "zod";
import type { Db } from "./db";
import { DEFAULTS, setSettings, type Settings } from "./settings";
import { AppError } from "./errors";
import { cleanTerm, normalizeTerm, slugify } from "./text";
import { openInitialRound } from "./voting";
import { uniqueSlug } from "./words";

export type Part = "einstellungen" | "woerter";
export const PARTS: Part[] = ["einstellungen", "woerter"];

// Install state (setup flag, setup token) never travels between instances.
const SETTING_KEYS = Object.keys(DEFAULTS).filter((k) => k !== "setupCompleted" && k !== "setupTokenHash") as (keyof Settings)[];

export async function exportData(db: Db, parts: Part[]) {
  const out: Record<string, unknown> = { app: "peake-woerter", version: 1, exportedAt: new Date().toISOString() };
  out.categories = await db.category.findMany({ orderBy: { name: "asc" }, select: { name: true, color: true, nsfw: true, keywords: true } });
  if (parts.includes("einstellungen")) {
    const rows = await db.appSetting.findMany({ where: { key: { in: SETTING_KEYS } } });
    out.settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }
  if (parts.includes("woerter")) {
    const words = await db.word.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        term: true,
        status: true,
        cardNumber: true,
        partOfSpeech: true,
        grammar: true,
        usage: true,
        origin: true,
        variants: true,
        submissionNote: true,
        source: true,
        guestName: true,
        acceptedAt: true,
        createdAt: true,
        definitions: { orderBy: { position: "asc" }, select: { text: true, detail: true } },
        pronunciations: { orderBy: { position: "asc" }, select: { ipa: true, label: true, verified: true } },
        examples: { orderBy: { position: "asc" }, select: { text: true } },
        categories: { select: { auto: true, category: { select: { name: true } } } },
      },
    });
    out.words = words.map(({ examples, categories, ...w }) => ({
      ...w,
      examples: examples.map((e) => e.text),
      categories: categories.map((c) => ({ name: c.category.name, auto: c.auto })),
    }));
  }
  return out;
}

const str = (max: number) => z.string().max(max);
const opt = (max: number) => str(max).nullish();

const Category = z.object({ name: str(80).min(1), color: str(20).optional(), nsfw: z.boolean().optional(), keywords: z.array(str(80)).max(500).optional() });

const Word = z.object({
  term: str(200).min(1),
  status: z.enum(["VOTING", "LATER", "ACCEPTED", "REJECTED"]),
  cardNumber: z.number().int().positive().nullish(),
  partOfSpeech: z.enum(["SUBSTANTIV", "VERB", "ADJEKTIV", "ADVERB", "INTERJEKTION", "REDEWENDUNG", "SONSTIGES"]).nullish(),
  grammar: opt(300),
  usage: opt(5000),
  origin: opt(5000),
  variants: z.array(str(200)).max(50).default([]),
  submissionNote: opt(5000),
  source: z.enum(["CURATOR", "GUEST"]).default("CURATOR"),
  guestName: opt(120),
  acceptedAt: z.coerce.date().nullish(),
  createdAt: z.coerce.date().optional(),
  definitions: z.array(z.object({ text: str(5000), detail: opt(20000) })).max(50).default([]),
  pronunciations: z.array(z.object({ ipa: str(200), label: opt(200), verified: z.boolean().default(false) })).max(20).default([]),
  examples: z.array(str(5000)).max(100).default([]),
  categories: z.array(z.object({ name: str(80), auto: z.boolean().default(false) })).max(100).default([]),
});

// Same limits as the settings forms in app/actions/admin.ts.
const SettingsIn = z
  .object({
    require2fa: z.boolean(),
    requirePasskey: z.boolean(),
    aiProvider: z.enum(["none", "openai-compatible", "anthropic"]),
    aiBaseUrl: str(300).refine((s) => s === "" || /^https?:\/\//.test(s)),
    aiModel: str(120),
    voterCount: z.number().int().min(2).max(20),
    voteRule: z.enum(["majority", "unanimous"]),
    voteDeadlineHours: z.number().int().min(0).max(24 * 365),
    guestEnabled: z.boolean(),
    guestOpenUntil: str(40),
    gameVoice: z.boolean(),
    autoTag: z.boolean(),
  })
  .partial();

const File = z.object({
  app: z.literal("peake-woerter"),
  version: z.literal(1),
  categories: z.array(Category).max(1000).default([]),
  settings: SettingsIn.optional(),
  words: z.array(Word).max(100_000).optional(),
});

export type ImportResult = { settings: number; categories: number; words: number; skipped: number; notes: string[] };

export function parseImport(text: string) {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AppError("Die Datei ist kein gültiges JSON.");
  }
  const r = File.safeParse(json);
  if (!r.success) throw new AppError(`Keine gültige Peake-Exportdatei (${r.error.issues[0].path.join(".") || "Format"}).`);
  return r.data;
}

export async function importData(db: Db, data: z.infer<typeof File>, parts: Part[], userId: string): Promise<ImportResult> {
  const res: ImportResult = { settings: 0, categories: 0, words: 0, skipped: 0, notes: [] };
  const withSettings = parts.includes("einstellungen");
  const withWords = parts.includes("woerter") && !!data.words;

  if (withSettings && data.settings) {
    const s = { ...data.settings };
    const highest = (await db.curatorSeat.aggregate({ _max: { seat: true } }))._max.seat ?? 0;
    if (s.voterCount !== undefined && s.voterCount < highest) {
      res.notes.push(`Voter-Anzahl ${s.voterCount} nicht übernommen: Platz ${highest} ist belegt.`);
      delete s.voterCount;
    }
    await setSettings(db, s);
    res.settings = Object.keys(s).length;
  }

  // Categories: settings import updates existing ones; a words import only adds missing ones.
  const catIds = new Map((await db.category.findMany({ select: { id: true, name: true } })).map((c) => [c.name, c.id]));
  if (withSettings || withWords) {
    for (const c of data.categories) {
      const fields = { color: c.color ?? "ink", nsfw: c.nsfw ?? false, keywords: c.keywords ?? [] };
      const id = catIds.get(c.name);
      if (id) {
        if (withSettings) await db.category.update({ where: { id }, data: fields });
        continue;
      }
      let slug = slugify(c.name);
      for (let i = 2; await db.category.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${slugify(c.name)}-${i}`;
      catIds.set(c.name, (await db.category.create({ data: { name: c.name, slug, ...fields } })).id);
      res.categories++;
    }
  }

  if (withWords) {
    const taken = new Set((await db.word.findMany({ where: { cardNumber: { not: null } }, select: { cardNumber: true } })).map((w) => w.cardNumber!));
    let next = Math.max(0, ...taken) + 1;
    for (const w of data.words!) {
      const term = cleanTerm(w.term);
      const normalized = normalizeTerm(term);
      if (!normalized || (await db.word.findUnique({ where: { normalized }, select: { id: true } }))) {
        res.skipped++;
        continue;
      }
      const accepted = w.status === "ACCEPTED";
      let cardNumber: number | null = null;
      if (accepted) cardNumber = w.cardNumber && !taken.has(w.cardNumber) ? w.cardNumber : next++;
      if (cardNumber) {
        taken.add(cardNumber);
        next = Math.max(next, cardNumber + 1);
      }
      await db.$transaction(async (tx) => {
        const word = await tx.word.create({
          data: {
            term,
            normalized,
            slug: await uniqueSlug(tx, term),
            status: w.status,
            // Mirrors what closeRound in lib/voting.ts sets for each outcome.
            isPublic: accepted,
            cardNumber,
            acceptedAt: accepted ? (w.acceptedAt ?? new Date()) : (w.acceptedAt ?? null),
            createdAt: w.createdAt,
            partOfSpeech: w.partOfSpeech ?? null,
            grammar: w.grammar ?? null,
            usage: w.usage ?? null,
            origin: w.origin ?? null,
            variants: w.variants,
            submissionNote: w.submissionNote ?? null,
            source: w.source,
            guestName: w.guestName ?? null,
            submittedById: null,
            definitions: { create: w.definitions.map((d, i) => ({ position: i + 1, text: d.text, detail: d.detail ?? null })) },
            pronunciations: { create: w.pronunciations.map((p, i) => ({ position: i + 1, ipa: p.ipa, label: p.label ?? null, verified: p.verified })) },
            examples: { create: w.examples.map((text, i) => ({ position: i + 1, text })) },
            categories: {
              create: [...new Map(w.categories.filter((c) => catIds.has(c.name)).map((c) => [c.name, c])).values()].map((c) => ({ categoryId: catIds.get(c.name)!, auto: c.auto })),
            },
          },
        });
        // A word in VOTING needs its open round, like a fresh submission.
        if (w.status === "VOTING") await openInitialRound(tx, word.id, userId);
      });
      res.words++;
    }
  }
  return res;
}
