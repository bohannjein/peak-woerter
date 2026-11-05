// Wortjagd: guess today's archive word in six tries. Any letters count (there is
// no dictionary of our words to check against); after three misses the first
// definition shows up as a hint.
import { z } from "zod";
import { AppError } from "../errors";
import { foldLetters } from "../text";
import { fresh, pick, type PuzzleKind } from "./types";

export const MAX_GUESSES = 6;
const HINT_AFTER = 3;

export type Mark = "hit" | "near" | "miss";
type P = { answer: string; term: string; slug: string; hint: string | null };
type S = { guesses: string[] };
export type WortjagdView = {
  length: number;
  maxGuesses: number;
  rows: { guess: string; marks: Mark[] }[];
  hint: string | null;
  solution: { term: string; slug: string } | null;
};

export const answerOf = (term: string) => {
  const f = foldLetters(term);
  return /^[a-z]{4,8}$/.test(f) ? f : null;
};

/** Two passes so that double letters are only marked as often as they occur. */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(answer.length).fill("miss");
  const left = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = "hit";
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < answer.length; i++) {
    if (marks[i] === "hit") continue;
    const n = left.get(guess[i]) ?? 0;
    if (n > 0) {
      marks[i] = "near";
      left.set(guess[i], n - 1);
    }
  }
  return marks;
}

export const wortjagd: PuzzleKind<P, S, WortjagdView> = {
  generate(words, rand, recent) {
    const ok = words.filter((w) => answerOf(w.term));
    if (!ok.length) return null;
    const w = pick(fresh(ok, recent), rand);
    return { wordId: w.id, puzzle: { answer: answerOf(w.term)!, term: w.term, slug: w.slug, hint: w.definition } };
  },
  initial: () => ({ guesses: [] }),
  view(p, s, finished) {
    return {
      length: p.answer.length,
      maxGuesses: MAX_GUESSES,
      rows: s.guesses.map((g) => ({ guess: g, marks: scoreGuess(g, p.answer) })),
      hint: finished || s.guesses.length >= HINT_AFTER ? p.hint : null,
      solution: finished ? { term: p.term, slug: p.slug } : null,
    };
  },
  move(p, s, input) {
    const raw = z.object({ guess: z.string().max(40) }).parse(input).guess;
    const guess = foldLetters(raw).replace(/\s+/g, "");
    if (!/^[a-z]+$/.test(guess)) throw new AppError("Nur Buchstaben (ä als ae, ß als ss).");
    if (guess.length !== p.answer.length) throw new AppError(`Das Wort hat ${p.answer.length} Buchstaben.`);
    const guesses = [...s.guesses, guess];
    const won = guess === p.answer;
    const finished = won || guesses.length >= MAX_GUESSES;
    return { state: { guesses }, finished, won, score: won ? guesses.length : null };
  },
};
