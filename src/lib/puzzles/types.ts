// Shared shape of the daily puzzles. Each module is pure: the generator gets the
// word pool and a random source, moves get the stored puzzle and state.
import type { PartOfSpeech } from "@/generated/prisma/enums";

export type PoolWord = {
  id: string;
  term: string;
  slug: string;
  partOfSpeech: PartOfSpeech | null;
  definition: string | null;
  categories: { id: string; name: string; color: string }[];
};

export type Outcome<S> = { state: S; finished: boolean; won: boolean; score?: number | null; durationMs?: number | null };

export type Rand = () => number;

export interface PuzzleKind<P, S, V> {
  /** null = not enough suitable words in the archive. */
  generate(words: PoolWord[], rand: Rand, recent: Set<string>): { wordId: string; puzzle: P } | null;
  initial(p: P, now: number): S;
  /** What the player may see. Never contains the solution while the game runs. */
  view(p: P, s: S, finished: boolean): V;
  /** Throws AppError for invalid moves. */
  move(p: P, s: S, input: unknown, now: number): Outcome<S>;
}

export function pick<T>(xs: readonly T[], rand: Rand): T {
  return xs[Math.floor(rand() * xs.length)];
}

export function shuffle<T>(xs: readonly T[], rand: Rand): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Prefer words not used recently; fall back to all when that leaves nothing. */
export function fresh<T extends { id: string }>(xs: T[], recent: Set<string>): T[] {
  const f = xs.filter((x) => !recent.has(x.id));
  return f.length ? f : xs;
}
