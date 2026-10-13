import type { Db } from "./db";
import { berlinDay } from "./time";

const include = {
  definitions: { orderBy: { position: "asc" } },
  pronunciations: { orderBy: { position: "asc" } },
  examples: { orderBy: { position: "asc" } },
} as const;

/**
 * Word of the day: picked once per Berlin calendar day, stored, identical for
 * every visitor. A word that left the collection is replaced on the next request.
 */
export async function getWordOfDay(db: Db, day = berlinDay()) {
  const current = await db.dailyWord.findUnique({ where: { day }, include: { word: { include } } });
  if (current?.word.isPublic) return current.word;

  const total = await db.word.count({ where: { isPublic: true } });
  if (total === 0) return null;

  // Avoid repeating recent picks while the collection allows it.
  const recent = await db.dailyWord.findMany({
    where: { day: { lt: day } },
    orderBy: { day: "desc" },
    take: Math.min(60, total - 1),
    select: { wordId: true },
  });
  const exclude = recent.map((r) => r.wordId).concat(current ? [current.wordId] : []);
  let pool = await db.word.findMany({ where: { isPublic: true, id: { notIn: exclude } }, select: { id: true } });
  if (pool.length === 0) pool = await db.word.findMany({ where: { isPublic: true }, select: { id: true } });
  const pick = pool[Math.floor(Math.random() * pool.length)].id;

  if (current) {
    // Conditional: only replace if no concurrent request did it already.
    await db.dailyWord.updateMany({ where: { day, wordId: current.wordId }, data: { wordId: pick, pickedAt: new Date() } });
  } else {
    await db.dailyWord.createMany({ data: [{ day, wordId: pick }], skipDuplicates: true });
  }
  const final = await db.dailyWord.findUnique({ where: { day }, include: { word: { include } } });
  return final?.word.isPublic ? final.word : null;
}
