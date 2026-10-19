// Minigames. One round per game and Berlin day.
// Day D: everyone gets the same random word and writes (or records) a sentence.
// Day D+1: everyone votes for the best sentence of day D (not their own).
// From D+2: the entries with the most votes have won; ties all win.
// New games: add a key to GAMES and a page; rounds, entries and votes are shared.
import type { Db } from "./db";
import { AppError } from "./errors";
import { berlinDay } from "./time";

export const GAMES = {
  satz: { title: "Satzbau", description: "Ein Wort aus dem Archiv, ein glaubwürdiger Satz damit. Morgen wird abgestimmt." },
} as const;
export type GameKey = keyof typeof GAMES;

export function previousDay(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Today's round; created on first request with a random word from the collection. */
export async function todaysRound(db: Db, game: GameKey = "satz", day = berlinDay()) {
  const existing = await db.gameRound.findUnique({ where: { game_day: { game, day } } });
  if (existing) return existing;
  const n = await db.word.count({ where: { isPublic: true } });
  if (!n) return null;
  const [w] = await db.word.findMany({ where: { isPublic: true }, select: { id: true }, skip: Math.floor(Math.random() * n), take: 1, orderBy: { id: "asc" } });
  await db.gameRound.createMany({ data: [{ game, day, wordId: w.id }], skipDuplicates: true });
  return db.gameRound.findUnique({ where: { game_day: { game, day } } });
}

export async function submitEntry(db: Db, input: { userId: string; game?: GameKey; text?: string | null; audioPath?: string | null; day?: string }) {
  const round = await todaysRound(db, input.game ?? "satz", input.day);
  if (!round) throw new AppError("Noch keine Wörter im Archiv.");
  const text = input.text?.trim() || null;
  if (!text && !input.audioPath) throw new AppError("Bitte einen Satz schreiben oder aufnehmen.");
  if (text && (text.length < 3 || text.length > 300)) throw new AppError("Der Satz braucht 3 bis 300 Zeichen.");
  if (await db.gameEntry.findUnique({ where: { roundId_userId: { roundId: round.id, userId: input.userId } } })) {
    throw new AppError("Du hast heute schon mitgespielt.", 409);
  }
  return db.gameEntry.create({ data: { roundId: round.id, userId: input.userId, text, audioPath: input.audioPath ?? null } });
}

/** Votes go to yesterday's round only, one per person, never for the own entry. */
export async function voteEntry(db: Db, input: { voterId: string; entryId: string; today?: string }) {
  const entry = await db.gameEntry.findUnique({ where: { id: input.entryId }, include: { round: true } });
  if (!entry) throw new AppError("Beitrag nicht gefunden.", 404);
  if (entry.round.day !== previousDay(input.today ?? berlinDay())) throw new AppError("Für diese Runde ist die Abstimmung zu.", 409);
  if (entry.userId === input.voterId) throw new AppError("Für dich selbst stimmen gilt nicht.", 403);
  if (await db.gameVote.findUnique({ where: { roundId_voterId: { roundId: entry.roundId, voterId: input.voterId } } })) {
    throw new AppError("Du hast schon abgestimmt.", 409);
  }
  return db.gameVote.create({ data: { roundId: entry.roundId, voterId: input.voterId, entryId: entry.id } });
}

/** Entries of a finished round with their votes; winners = most votes (> 0). */
export async function roundResult(db: Db, roundId: string) {
  const entries = await db.gameEntry.findMany({
    where: { roundId },
    include: { user: { select: { id: true, name: true } }, _count: { select: { votes: true } } },
    orderBy: { createdAt: "asc" },
  });
  const best = Math.max(0, ...entries.map((e) => e._count.votes));
  return entries.map((e) => ({ ...e, votes: e._count.votes, won: best > 0 && e._count.votes === best }));
}

/** Wins per user over all finished rounds (finished = voting day is over). */
export async function winsByUser(db: Db, today = berlinDay()) {
  const rows = await db.$queryRaw<{ userId: string; n: bigint }[]>`
    WITH counts AS (
      SELECT e.id, e."userId", e."roundId", count(v.id) AS n
      FROM game_entry e JOIN game_round r ON r.id = e."roundId"
      LEFT JOIN game_vote v ON v."entryId" = e.id
      WHERE r.day < ${previousDay(today)}
      GROUP BY e.id
    ), best AS (SELECT "roundId", max(n) AS m FROM counts GROUP BY "roundId")
    SELECT c."userId", count(*) AS n FROM counts c JOIN best b ON b."roundId" = c."roundId" AND c.n = b.m
    WHERE b.m > 0 GROUP BY c."userId"`;
  return new Map(rows.map((r) => [r.userId, Number(r.n)]));
}

export async function gameWins(db: Db, userId: string, today = berlinDay()) {
  return (await winsByUser(db, today)).get(userId) ?? 0;
}
