// Echt oder erfunden? Five archive words, four meanings each: one is real, three
// belong to other words (of the same part of speech where possible).
import { z } from "zod";
import { AppError } from "../errors";
import { fresh, shuffle, type PuzzleKind } from "./types";

export const QUESTIONS = 5;

type Q = { term: string; slug: string; options: string[]; correct: number };
type P = { questions: Q[] };
type S = { answers: number[] };
export type BedeutungView = {
  total: number;
  /** Answered questions with the solution. */
  done: { term: string; slug: string; options: string[]; correct: number; chosen: number }[];
  current: { term: string; options: string[] } | null;
  score: number;
};

const score = (p: P, s: S) => s.answers.filter((a, i) => a === p.questions[i].correct).length;

export const bedeutung: PuzzleKind<P, S, BedeutungView> = {
  generate(words, rand, recent) {
    const defined = words.filter((w) => w.definition);
    // Distinct meanings, so no option appears twice.
    const unique = defined.filter((w, i) => defined.findIndex((x) => x.definition === w.definition) === i);
    if (unique.length < QUESTIONS || unique.length < 4) return null;
    const targets = shuffle(fresh(unique, recent), rand).slice(0, QUESTIONS);
    if (targets.length < QUESTIONS) targets.push(...shuffle(unique.filter((w) => !targets.includes(w)), rand).slice(0, QUESTIONS - targets.length));
    const questions = targets.map((w) => {
      const others = shuffle(unique.filter((x) => x.id !== w.id), rand);
      const same = others.filter((x) => x.partOfSpeech && x.partOfSpeech === w.partOfSpeech);
      const decoys = [...same, ...others.filter((x) => !same.includes(x))].slice(0, 3).map((x) => x.definition!);
      const options = shuffle([w.definition!, ...decoys], rand);
      return { term: w.term, slug: w.slug, options, correct: options.indexOf(w.definition!) };
    });
    return { wordId: targets[0].id, puzzle: { questions } };
  },
  initial: () => ({ answers: [] }),
  view(p, s) {
    const next = p.questions[s.answers.length];
    return {
      total: p.questions.length,
      done: s.answers.map((chosen, i) => ({ ...p.questions[i], chosen })),
      current: next ? { term: next.term, options: next.options } : null,
      score: score(p, s),
    };
  },
  move(p, s, input) {
    const { choice } = z.object({ choice: z.number().int().min(0).max(3) }).parse(input);
    if (s.answers.length >= p.questions.length) throw new AppError("Schon fertig.");
    const state = { answers: [...s.answers, choice] };
    const finished = state.answers.length === p.questions.length;
    const n = score(p, state);
    return { state, finished, won: finished && n === p.questions.length, score: finished ? n : null };
  },
};
