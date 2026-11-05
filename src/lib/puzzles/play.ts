// Player progress in the daily puzzles. The round holds the puzzle (with the
// solution), GamePlay holds the player's state; moves run under a row lock so
// two tabs cannot both use the last try.
import type { Db } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "../errors";
import { previousDay, todaysRound } from "../games";
import { berlinDay } from "../time";
import { puzzleKind, PUZZLES, type PuzzleKey, type PuzzleView } from "./registry";

export type PlayResult<K extends PuzzleKey> = { view: PuzzleView<K>; finished: boolean; won: boolean; score: number | null; durationMs: number | null };

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Today's puzzle for the player; null = not enough suitable words yet. */
export async function loadPlay<K extends PuzzleKey>(db: Db, game: K, userId: string, day = berlinDay(), now = Date.now()): Promise<PlayResult<K> | null> {
  const round = await todaysRound(db, game, day);
  if (!round?.puzzle) return null;
  const kind = puzzleKind(game);
  const play =
    (await db.gamePlay.findUnique({ where: { roundId_userId: { roundId: round.id, userId } } })) ??
    (await db.gamePlay.upsert({
      where: { roundId_userId: { roundId: round.id, userId } },
      create: { roundId: round.id, userId, state: json(kind.initial(round.puzzle, now)) },
      update: {},
    }));
  return { view: kind.view(round.puzzle, play.state, play.finished) as PuzzleView<K>, finished: play.finished, won: play.won, score: play.score, durationMs: play.durationMs };
}

export async function playMove<K extends PuzzleKey>(db: Db, game: K, userId: string, input: unknown, day = berlinDay(), now = Date.now()): Promise<PlayResult<K>> {
  if (!(await loadPlay(db, game, userId, day, now))) throw new AppError("Heute gibt es dieses Rätsel nicht.", 404);
  const kind = puzzleKind(game);
  return db.$transaction(async (tx) => {
    const round = await tx.gameRound.findUniqueOrThrow({ where: { game_day: { game, day } } });
    await tx.$executeRaw`SELECT 1 FROM game_play WHERE "roundId" = ${round.id} AND "userId" = ${userId} FOR UPDATE`;
    const play = await tx.gamePlay.findUniqueOrThrow({ where: { roundId_userId: { roundId: round.id, userId } } });
    if (play.finished) throw new AppError("Für heute ist das Rätsel gespielt.", 409);
    const o = kind.move(round.puzzle, play.state, input, now);
    const saved = await tx.gamePlay.update({
      where: { id: play.id },
      data: { state: json(o.state), finished: o.finished, won: o.won, score: o.score ?? null, durationMs: o.durationMs ?? null },
    });
    return { view: kind.view(round.puzzle, saved.state, saved.finished) as PuzzleView<K>, finished: saved.finished, won: saved.won, score: saved.score, durationMs: saved.durationMs };
  });
}

/** Consecutive days with a finished puzzle, ending today (or yesterday, if today is still open). */
export function streakOf(days: Iterable<string>, today = berlinDay()) {
  const set = new Set(days);
  let d = set.has(today) ? today : previousDay(today);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = previousDay(d);
  }
  return n;
}

/** Per game: today's status and the streak; plus totals for the profile. */
export async function puzzleStats(db: Db, userId: string, today = berlinDay()) {
  const plays = await db.gamePlay.findMany({
    where: { userId, finished: true, round: { game: { in: Object.keys(PUZZLES) } } },
    select: { won: true, round: { select: { game: true, day: true } } },
  });
  const games = Object.fromEntries(
    (Object.keys(PUZZLES) as PuzzleKey[]).map((g) => {
      const mine = plays.filter((p) => p.round.game === g);
      const todayPlay = mine.find((p) => p.round.day === today);
      return [g, { today: todayPlay ? (todayPlay.won ? "won" : "done") : "open", streak: streakOf(mine.map((p) => p.round.day), today), played: mine.length, won: mine.filter((p) => p.won).length }];
    }),
  ) as Record<PuzzleKey, { today: "open" | "won" | "done"; streak: number; played: number; won: number }>;
  return { games, played: plays.length, won: plays.filter((p) => p.won).length, streak: streakOf(plays.map((p) => p.round.day), today) };
}
