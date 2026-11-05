// Belege: when and where a word of the collection was actually said.
import type { Db } from "./db";
import { AppError } from "./errors";
import { notify } from "./notifications";
import { berlinDay } from "./time";

export type SightingInput = { saidOn: string; occasion: string; saidBy?: string | null; quote?: string | null };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Validates and normalises the form input; throws a readable error. */
export function cleanSighting(input: SightingInput, today = berlinDay()) {
  const occasion = input.occasion.trim();
  const saidBy = input.saidBy?.trim() || null;
  const quote = input.quote?.trim().replace(/^[„"“]+|[“"”]+$/g, "").trim() || null;
  if (!DAY.test(input.saidOn) || Number.isNaN(Date.parse(`${input.saidOn}T00:00:00Z`))) throw new AppError("Bitte ein Datum angeben.");
  if (input.saidOn > today) throw new AppError("Das Datum liegt in der Zukunft.");
  if (input.saidOn < "1900-01-01") throw new AppError("So alt ist das Wort nicht.");
  if (!occasion) throw new AppError("Wo oder bei welcher Gelegenheit ist es gefallen?");
  if (occasion.length > 120) throw new AppError("Anlass ist zu lang (max. 120 Zeichen).");
  if (saidBy && saidBy.length > 60) throw new AppError("Name ist zu lang (max. 60 Zeichen).");
  if (quote && quote.length > 300) throw new AppError("Zitat ist zu lang (max. 300 Zeichen).");
  return { saidOn: new Date(`${input.saidOn}T00:00:00Z`), occasion, saidBy, quote };
}

export async function addSighting(db: Db, input: SightingInput & { wordId: string; userId: string }) {
  const data = cleanSighting(input);
  return db.$transaction(async (tx) => {
    const word = await tx.word.findUnique({ where: { id: input.wordId }, select: { term: true, slug: true, isPublic: true, submittedById: true } });
    if (!word?.isPublic) throw new AppError("Wort nicht gefunden.", 404);
    const s = await tx.sighting.create({ data: { ...data, wordId: input.wordId, userId: input.userId } });
    if (word.submittedById && word.submittedById !== input.userId) {
      const by = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { name: true } });
      await notify(tx, [word.submittedById], { wordId: input.wordId, kind: "beleg", body: `${by.name} hat „${word.term}“ belegt: ${data.occasion}`, href: `/wort/${word.slug}#belege` });
    }
    return { ...s, slug: word.slug };
  });
}

/** Own Belege can be removed; admins can remove any. */
export async function deleteSighting(db: Db, id: string, viewer: { id: string; isAdmin: boolean }) {
  const s = await db.sighting.findUnique({ where: { id }, select: { userId: true, word: { select: { slug: true } } } });
  if (!s) throw new AppError("Beleg nicht gefunden.", 404);
  if (s.userId !== viewer.id && !viewer.isAdmin) throw new AppError("Nur eigene Belege kannst du löschen.", 403);
  await db.sighting.delete({ where: { id } });
  return s.word.slug;
}

export const sightingsOf = (db: Db, wordId: string) =>
  db.sighting.findMany({
    where: { wordId },
    orderBy: [{ saidOn: "desc" }, { createdAt: "desc" }],
    select: { id: true, saidOn: true, occasion: true, saidBy: true, quote: true, user: { select: { id: true, name: true } } },
  });
