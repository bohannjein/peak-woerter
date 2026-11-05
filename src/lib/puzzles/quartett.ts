// Quartett: sixteen archive words, four categories. Find the four sets of four.
// Every word belongs to exactly one of the chosen categories, so there is only
// one solution. Four mistakes end the game.
import { z } from "zod";
import { AppError } from "../errors";
import { shuffle, type PoolWord, type PuzzleKind } from "./types";

export const MAX_MISTAKES = 4;
const ATTEMPTS = 60;

type Group = { name: string; color: string; words: { term: string; slug: string }[] };
type P = { groups: Group[]; tiles: { term: string; group: number }[] };
export type Feedback = "richtig" | "knapp" | "falsch" | "doppelt" | null;
type S = { solved: number[]; mistakes: number; tried: string[]; last: Feedback };
export type QuartettView = {
  tiles: { index: number; term: string }[];
  solved: Group[];
  mistakesLeft: number;
  last: Feedback;
};

function build(words: PoolWord[], rand: () => number): P | null {
  const byCat = new Map<string, { name: string; color: string; words: PoolWord[] }>();
  for (const w of words)
    for (const c of w.categories) {
      const e = byCat.get(c.id) ?? { name: c.name, color: c.color, words: [] };
      e.words.push(w);
      byCat.set(c.id, e);
    }
  const cats = [...byCat.entries()].filter(([, c]) => c.words.length >= 4);
  if (cats.length < 4) return null;
  for (let t = 0; t < ATTEMPTS; t++) {
    const chosen = shuffle(cats, rand).slice(0, 4);
    const ids = new Set(chosen.map(([id]) => id));
    // Only words that belong to exactly one chosen category.
    const groups = chosen.map(([id, c]) => ({
      ...c,
      words: c.words.filter((w) => w.categories.filter((x) => ids.has(x.id)).length === 1 && w.categories.some((x) => x.id === id)),
    }));
    if (groups.some((g) => g.words.length < 4)) continue;
    const picked = groups.map((g) => ({ name: g.name, color: g.color, words: shuffle(g.words, rand).slice(0, 4).map((w) => ({ term: w.term, slug: w.slug })) }));
    const tiles = shuffle(picked.flatMap((g, i) => g.words.map((w) => ({ term: w.term, group: i }))), rand);
    return { groups: picked, tiles };
  }
  return null;
}

export const quartett: PuzzleKind<P, S, QuartettView> = {
  generate(words, rand) {
    const p = build(words, rand);
    if (!p) return null;
    const first = words.find((w) => w.slug === p.groups[0].words[0].slug)!;
    return { wordId: first.id, puzzle: p };
  },
  initial: () => ({ solved: [], mistakes: 0, tried: [], last: null }),
  view(p, s, finished) {
    const shown = finished ? [...s.solved, ...p.groups.map((_, i) => i).filter((i) => !s.solved.includes(i))] : s.solved;
    return {
      tiles: p.tiles.map((t, index) => ({ index, term: t.term, group: t.group })).filter((t) => !shown.includes(t.group)).map(({ index, term }) => ({ index, term })),
      solved: shown.map((i) => p.groups[i]),
      mistakesLeft: MAX_MISTAKES - s.mistakes,
      last: s.last,
    };
  },
  move(p, s, input) {
    const { tiles } = z.object({ tiles: z.array(z.number().int().min(0).max(15)).length(4) }).parse(input);
    if (new Set(tiles).size !== 4) throw new AppError("Vier verschiedene Wörter wählen.");
    const groups = tiles.map((i) => p.tiles[i].group);
    if (groups.some((g) => s.solved.includes(g))) throw new AppError("Diese Gruppe ist schon gelöst.");
    const key = [...tiles].sort((a, b) => a - b).join(",");
    if (s.tried.includes(key)) return { state: { ...s, last: "doppelt" }, finished: false, won: false };
    const counts = new Map<number, number>();
    for (const g of groups) counts.set(g, (counts.get(g) ?? 0) + 1);
    const best = Math.max(...counts.values());
    const tried = [...s.tried, key];
    if (best === 4) {
      const solved = [...s.solved, groups[0]];
      const won = solved.length === 4;
      return { state: { ...s, solved, tried, last: "richtig" }, finished: won, won, score: won ? s.mistakes : null };
    }
    const mistakes = s.mistakes + 1;
    const finished = mistakes >= MAX_MISTAKES;
    return { state: { ...s, mistakes, tried, last: best === 3 ? "knapp" : "falsch" }, finished, won: false };
  },
};
