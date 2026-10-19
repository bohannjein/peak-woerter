// Read models. Public queries only ever select public fields of public words.
import type { Db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeTerm } from "./text";

export const publicWordWhere = { isPublic: true } satisfies Prisma.WordWhereInput;

/** Public words; in SFW mode without words from NSFW categories. */
export const publicWhere = (sfw = false): Prisma.WordWhereInput =>
  sfw ? { isPublic: true, categories: { none: { category: { nsfw: true } } } } : publicWordWhere;

export const publicEntrySelect = {
  id: true,
  term: true,
  slug: true,
  cardNumber: true,
  partOfSpeech: true,
  grammar: true,
  usage: true,
  origin: true,
  variants: true,
  acceptedAt: true,
  definitions: { orderBy: { position: "asc" }, select: { position: true, text: true, detail: true } },
  pronunciations: { orderBy: { position: "asc" }, select: { position: true, ipa: true, label: true, verified: true, audioPath: true } },
  examples: { orderBy: { position: "asc" }, select: { text: true } },
  categories: { select: { auto: true, category: { select: { name: true, slug: true, color: true } } } },
  _count: { select: { rounds: true } },
} satisfies Prisma.WordSelect;

export type PublicEntry = Prisma.WordGetPayload<{ select: typeof publicEntrySelect }>;

export type CollectionQuery = { q?: string; kategorie?: string; sort?: "az" | "neu" | "kat"; sfw?: boolean };

export async function listPublicWords(db: Db, query: CollectionQuery) {
  const q = query.q ? normalizeTerm(query.q) : "";
  const where: Prisma.WordWhereInput = {
    ...publicWhere(query.sfw),
    ...(q
      ? {
          OR: [
            { normalized: { contains: q } },
            { variants: { has: query.q!.trim() } },
            { definitions: { some: { text: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(query.kategorie ? { categories: { some: { category: { slug: query.kategorie } } } } : {}),
  };
  return db.word.findMany({
    where,
    select: publicEntrySelect,
    orderBy: query.sort === "neu" ? [{ acceptedAt: "desc" }] : [{ normalized: "asc" }],
  });
}

export async function getPublicEntry(db: Db, slug: string, sfw = false) {
  return db.word.findFirst({ where: { ...publicWhere(sfw), slug }, select: publicEntrySelect });
}

export async function randomPublicSlug(db: Db, sfw = false) {
  const where = publicWhere(sfw);
  const n = await db.word.count({ where });
  if (!n) return null;
  const [w] = await db.word.findMany({ where, select: { slug: true }, skip: Math.floor(Math.random() * n), take: 1, orderBy: { id: "asc" } });
  return w?.slug ?? null;
}

export async function publicCategories(db: Db, sfw = false) {
  const word = publicWhere(sfw);
  return db.category.findMany({
    where: { words: { some: { word } }, ...(sfw ? { nsfw: false } : {}) },
    orderBy: { name: "asc" },
    select: { name: true, slug: true, color: true, _count: { select: { words: { where: { word } } } } },
  });
}
