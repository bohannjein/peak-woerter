// Automatic tagging: a category gets a list of keywords; every word whose text
// (term, meanings, examples, usage, origin, note) contains a word starting with
// one of them is tagged. Auto tags are marked (word_category.auto) and can be
// edited like any other tag. Tagging only ever adds: a tag a person removed
// stays removed until the keywords change or someone re-runs the tagging.
// ponytail: plain keyword heuristic; the optional AI draft can suggest the rest.
import type { Db } from "./db";
import { audit } from "./audit";
import { getSettings } from "./settings";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Category ids whose keywords occur at the start of a word in `text`. */
export function matchCategories(text: string, categories: { id: string; keywords: string[] }[]) {
  const t = text.normalize("NFC").toLocaleLowerCase("de-DE");
  return categories
    .filter((c) => c.keywords.some((k) => new RegExp(`(^|[^\\p{L}])${esc(k.toLocaleLowerCase("de-DE"))}`, "u").test(t)))
    .map((c) => c.id);
}

const textSelect = {
  id: true,
  term: true,
  usage: true,
  origin: true,
  variants: true,
  submissionNote: true,
  definitions: { select: { text: true, detail: true } },
  examples: { select: { text: true } },
  categories: { select: { categoryId: true, auto: true } },
} as const;

type WordText = {
  term: string;
  usage: string | null;
  origin: string | null;
  variants: string[];
  submissionNote: string | null;
  definitions: { text: string; detail: string | null }[];
  examples: { text: string }[];
};

const wordText = (w: WordText) =>
  [w.term, w.usage, w.origin, w.submissionNote, ...w.variants, ...w.definitions.flatMap((d) => [d.text, d.detail]), ...w.examples.map((e) => e.text)]
    .filter(Boolean)
    .join("\n");

/** Tags one word (on submission). */
export async function autoTag(db: Db, wordId: string) {
  if (!(await getSettings(db)).autoTag) return;
  const [w, cats] = await Promise.all([
    db.word.findUnique({ where: { id: wordId }, select: textSelect }),
    db.category.findMany({ where: { NOT: { keywords: { isEmpty: true } } }, select: { id: true, keywords: true } }),
  ]);
  if (!w) return;
  const hits = new Set(matchCategories(wordText(w), cats));
  const add = [...hits].filter((id) => !w.categories.some((c) => c.categoryId === id));
  if (add.length) await db.wordCategory.createMany({ data: add.map((categoryId) => ({ wordId, categoryId, auto: true })), skipDuplicates: true });
}

/** After a category's keywords changed (or on demand): tag every word that matches. */
export async function autoTagAll(db: Db, categoryId: string) {
  if (!(await getSettings(db)).autoTag) return;
  const cat = await db.category.findUniqueOrThrow({ where: { id: categoryId }, select: { id: true, keywords: true } });
  const words = await db.word.findMany({ where: { categories: { none: { categoryId } } }, select: textSelect });
  const hit = words.filter((w) => matchCategories(wordText(w), [cat]).length);
  await db.wordCategory.createMany({ data: hit.map((w) => ({ wordId: w.id, categoryId, auto: true })), skipDuplicates: true });
}

/** Manual tagging of many words at once. */
export async function setTags(db: Db, input: { wordIds: string[]; categoryId: string; add: boolean; userId: string }) {
  if (input.add) {
    await db.wordCategory.createMany({ data: input.wordIds.map((wordId) => ({ wordId, categoryId: input.categoryId })), skipDuplicates: true });
    // An auto tag a person confirms becomes a manual one.
    await db.wordCategory.updateMany({ where: { wordId: { in: input.wordIds }, categoryId: input.categoryId }, data: { auto: false } });
  } else {
    await db.wordCategory.deleteMany({ where: { wordId: { in: input.wordIds }, categoryId: input.categoryId } });
  }
  await audit(db, input.userId, input.add ? "tags.added" : "tags.removed", "category", input.categoryId, { words: input.wordIds.length });
}
