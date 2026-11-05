// Buchstaben-Sudoku: a 6×6 (boxes 2×3) or 4×4 grid filled with the letters of an
// archive word whose letters are all different. Solved, the word reads along
// the marked row. Givens are removed only while the solution stays unique.
import { z } from "zod";
import { AppError } from "../errors";
import { fresh, pick, shuffle, type Rand, type PuzzleKind } from "./types";

type Grid = number[][]; // -1 = empty
type P = { n: number; br: number; bc: number; letters: string[]; givens: Grid; solution: Grid; row: number; term: string; slug: string; hint: string | null };
type S = { startedAt: number; attempts: number; entries: Grid | null };
export type SudokuView = {
  n: number;
  br: number;
  bc: number;
  letters: string[];
  givens: Grid;
  row: number;
  hint: string | null;
  entries: Grid | null;
  attempts: number;
  solution: { term: string; slug: string; grid: Grid } | null;
};

const SIZES = [
  { n: 6, br: 2, bc: 3, minGivens: 12 },
  { n: 4, br: 2, bc: 2, minGivens: 5 },
];

export function lettersOf(term: string, n: number) {
  const up = [...term.normalize("NFC").toLocaleUpperCase("de-DE")];
  return up.length === n && up.every((c) => /\p{L}/u.test(c)) && new Set(up).size === n ? up : null;
}

/** Solutions of a partial grid, counting stops at `limit`. */
export function countSolutions(g: Grid, br: number, bc: number, limit = 2): number {
  const n = g.length;
  const grid = g.map((r) => [...r]);
  let found = 0;
  const ok = (r: number, c: number, v: number) => {
    for (let i = 0; i < n; i++) if (grid[r][i] === v || grid[i][c] === v) return false;
    const r0 = r - (r % br), c0 = c - (c % bc);
    for (let i = 0; i < br; i++) for (let j = 0; j < bc; j++) if (grid[r0 + i][c0 + j] === v) return false;
    return true;
  };
  const solve = (pos: number): void => {
    if (found >= limit) return;
    if (pos === n * n) return void found++;
    const r = Math.floor(pos / n), c = pos % n;
    if (grid[r][c] !== -1) return solve(pos + 1);
    for (let v = 0; v < n; v++)
      if (ok(r, c, v)) {
        grid[r][c] = v;
        solve(pos + 1);
        grid[r][c] = -1;
      }
  };
  solve(0);
  return found;
}

export function isValidSolution(g: Grid, br: number, bc: number) {
  const n = g.length;
  const full = (xs: number[]) => xs.length === n && new Set(xs).size === n && xs.every((v) => v >= 0 && v < n);
  for (let i = 0; i < n; i++) if (!full(g[i]) || !full(g.map((r) => r[i]))) return false;
  for (let r0 = 0; r0 < n; r0 += br)
    for (let c0 = 0; c0 < n; c0 += bc) {
      const box: number[] = [];
      for (let i = 0; i < br; i++) for (let j = 0; j < bc; j++) box.push(g[r0 + i][c0 + j]);
      if (!full(box)) return false;
    }
  return true;
}

/** Random full grid: base pattern, shuffled bands/rows/stacks/columns/symbols. */
export function fullGrid(n: number, br: number, bc: number, rand: Rand): Grid {
  const groups = (size: number, count: number) => shuffle([...Array(count).keys()], rand).flatMap((b) => shuffle([...Array(size).keys()], rand).map((i) => b * size + i));
  const rows = groups(br, n / br);
  const cols = groups(bc, n / bc);
  const sym = shuffle([...Array(n).keys()], rand);
  return rows.map((r) => cols.map((c) => sym[(bc * (r % br) + Math.floor(r / br) + c) % n]));
}

export function makeSudoku(n: number, br: number, bc: number, minGivens: number, rand: Rand) {
  const solution = fullGrid(n, br, bc, rand);
  const givens = solution.map((r) => [...r]);
  let left = n * n;
  for (const pos of shuffle([...Array(n * n).keys()], rand)) {
    if (left <= minGivens) break;
    const r = Math.floor(pos / n), c = pos % n;
    const v = givens[r][c];
    givens[r][c] = -1;
    if (countSolutions(givens, br, bc) !== 1) givens[r][c] = v;
    else left--;
  }
  return { solution, givens };
}

export const sudoku: PuzzleKind<P, S, SudokuView> = {
  generate(words, rand, recent) {
    for (const size of SIZES) {
      const ok = words.filter((w) => lettersOf(w.term, size.n));
      if (!ok.length) continue;
      const w = pick(fresh(ok, recent), rand);
      const word = lettersOf(w.term, size.n)!;
      const { solution, givens } = makeSudoku(size.n, size.br, size.bc, size.minGivens, rand);
      const row = Math.floor(rand() * size.n);
      // Symbol k gets the letter that makes the marked row spell the word.
      const letters: string[] = Array(size.n);
      solution[row].forEach((v, c) => (letters[v] = word[c]));
      return { wordId: w.id, puzzle: { n: size.n, br: size.br, bc: size.bc, letters, givens, solution, row, term: w.term, slug: w.slug, hint: w.definition } };
    }
    return null;
  },
  initial: (_p, now) => ({ startedAt: now, attempts: 0, entries: null }),
  view(p, s, finished) {
    return {
      n: p.n,
      br: p.br,
      bc: p.bc,
      letters: p.letters,
      givens: p.givens,
      row: p.row,
      hint: p.hint,
      entries: s.entries,
      attempts: s.attempts,
      solution: finished ? { term: p.term, slug: p.slug, grid: p.solution } : null,
    };
  },
  move(p, s, input, now) {
    const { grid, check } = z
      .object({ grid: z.array(z.array(z.number().int().min(-1).max(p.n - 1)).length(p.n)).length(p.n), check: z.boolean().default(true) })
      .parse(input);
    for (let r = 0; r < p.n; r++) for (let c = 0; c < p.n; c++) if (p.givens[r][c] !== -1 && grid[r][c] !== p.givens[r][c]) throw new AppError("Vorgaben bleiben stehen.");
    // check: false only saves the progress.
    if (!check) return { state: { ...s, entries: grid }, finished: false, won: false };
    if (grid.some((r) => r.includes(-1))) throw new AppError("Erst alle Felder ausfüllen.");
    const won = isValidSolution(grid, p.br, p.bc);
    const state = { ...s, entries: grid, attempts: s.attempts + 1 };
    if (!won) return { state, finished: false, won: false };
    const durationMs = Math.max(0, now - s.startedAt);
    return { state, finished: true, won: true, score: Math.round(durationMs / 1000), durationMs };
  },
};
