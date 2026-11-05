// How the group did on today's puzzle: one row per member who started it.
import type { Db } from "../db";
import { MAX_GUESSES } from "./wortjagd";
import { QUESTIONS } from "./bedeutung";
import type { PuzzleKey } from "./registry";

export type PlayFacts = { finished: boolean; won: boolean; score: number | null; durationMs: number | null; updatedAt: Date };
export type GroupRow = { user: { id: string; name: string; avatarPath: string | null }; finished: boolean; won: boolean; label: string };

export function clock(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Short result text, the same wording as the share text. */
export function resultLabel(game: PuzzleKey, p: PlayFacts): string {
  if (!p.finished) return "spielt noch";
  switch (game) {
    case "wortjagd":
      return `${p.won ? p.score : "X"}/${MAX_GUESSES}`;
    case "quartett":
      return p.won ? (p.score === 0 ? "ohne Fehler" : `${p.score} Fehler`) : "nicht gelöst";
    case "bedeutung":
      return `${p.score ?? 0}/${QUESTIONS} richtig`;
    case "sudoku":
      return p.won && p.durationMs !== null ? clock(p.durationMs) : "gelöst";
  }
}

/** Lower is better, per game; finished before unfinished, solved before lost, then who was first. */
export function compareResults(game: PuzzleKey, a: PlayFacts, b: PlayFacts) {
  if (a.finished !== b.finished) return a.finished ? -1 : 1;
  if (a.won !== b.won) return a.won ? -1 : 1;
  const value = (p: PlayFacts) => (game === "bedeutung" ? -(p.score ?? 0) : game === "sudoku" ? (p.durationMs ?? Infinity) : (p.score ?? Infinity));
  return value(a) - value(b) || a.updatedAt.getTime() - b.updatedAt.getTime();
}

export async function groupResults(db: Db, game: PuzzleKey, day: string): Promise<GroupRow[]> {
  const plays = await db.gamePlay.findMany({
    where: { round: { game, day }, user: { disabled: false } },
    select: { finished: true, won: true, score: true, durationMs: true, updatedAt: true, user: { select: { id: true, name: true, avatarPath: true } } },
  });
  return plays
    .sort((a, b) => compareResults(game, a, b))
    .map((p) => ({ user: p.user, finished: p.finished, won: p.won, label: resultLabel(game, p) }));
}

/** Per game: how many finished and solved today (for the overview cards). */
export async function groupCounts(db: Db, day: string) {
  const rows = await db.gamePlay.groupBy({ by: ["roundId", "won"], where: { finished: true, round: { day } }, _count: { _all: true } });
  const rounds = await db.gameRound.findMany({ where: { day, id: { in: [...new Set(rows.map((r) => r.roundId))] } }, select: { id: true, game: true } });
  const gameOf = new Map(rounds.map((r) => [r.id, r.game]));
  const out: Record<string, { finished: number; won: number }> = {};
  for (const r of rows) {
    const g = gameOf.get(r.roundId)!;
    out[g] ??= { finished: 0, won: 0 };
    out[g].finished += r._count._all;
    if (r.won) out[g].won += r._count._all;
  }
  return out;
}
