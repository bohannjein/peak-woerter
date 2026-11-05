import { bedeutung } from "./bedeutung";
import { quartett } from "./quartett";
import { sudoku } from "./sudoku";
import { wortjagd } from "./wortjagd";
import type { PuzzleKind } from "./types";

export const PUZZLES = { wortjagd, quartett, bedeutung, sudoku } as const;
export type PuzzleKey = keyof typeof PUZZLES;
export type PuzzleView<K extends PuzzleKey> = ReturnType<(typeof PUZZLES)[K]["view"]>;

export const isPuzzle = (k: string): k is PuzzleKey => k in PUZZLES;
export const puzzleKind = (k: PuzzleKey) => PUZZLES[k] as unknown as PuzzleKind<unknown, unknown, unknown>;
