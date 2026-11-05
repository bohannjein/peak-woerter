"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import type { PlayResult } from "@/lib/puzzles/play";
import { dayLabel, MoveError, ShareButton, useMove } from "./common";

type Grid = number[][];

function conflicts(g: Grid, br: number, bc: number) {
  const n = g.length;
  const bad = new Set<string>();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const v = g[r][c];
      if (v === -1) continue;
      for (let i = 0; i < n; i++) {
        if (i !== c && g[r][i] === v) bad.add(`${r},${c}`);
        if (i !== r && g[i][c] === v) bad.add(`${r},${c}`);
      }
      const r0 = r - (r % br), c0 = c - (c % bc);
      for (let i = 0; i < br; i++) for (let j = 0; j < bc; j++) if ((r0 + i !== r || c0 + j !== c) && g[r0 + i][c0 + j] === v) bad.add(`${r},${c}`);
    }
  return bad;
}

const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

export function Sudoku({ initial, day }: { initial: PlayResult<"sudoku">; day: string }) {
  const { result, error, setError, pending, send } = useMove("sudoku", initial);
  const v = result.view;
  const key = `peake-sudoku-${day}`;
  const [grid, setGrid] = useState<Grid>(() => v.solution?.grid ?? v.entries ?? v.givens);
  const [sel, setSel] = useState<[number, number] | null>(null);

  // Progress survives a reload on this device; the server keeps it after each check.
  useEffect(() => {
    if (result.finished) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as Grid | null;
      if (saved?.length === v.n) setGrid(saved.map((r, i) => r.map((x, j) => (v.givens[i][j] === -1 ? x : v.givens[i][j]))));
    } catch {}
  }, []);
  const update = (g: Grid) => {
    setGrid(g);
    setError(null);
    try {
      localStorage.setItem(key, JSON.stringify(g));
    } catch {}
  };
  const put = (val: number) => {
    if (!sel || result.finished) return;
    const [r, c] = sel;
    if (v.givens[r][c] !== -1) return;
    update(grid.map((row, i) => row.map((x, j) => (i === r && j === c ? val : x))));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || result.finished) return;
      const k = e.key.toLocaleUpperCase("de-DE");
      const i = v.letters.indexOf(k);
      if (i >= 0) put(i);
      else if (e.key === "Backspace" || e.key === "Delete") put(-1);
      else if (sel && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const [r, c] = sel;
        const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key] ?? [0, 0];
        setSel([(r + d[0] + v.n) % v.n, (c + d[1] + v.n) % v.n]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const bad = conflicts(grid, v.br, v.bc);
  const full = grid.every((r) => r.every((x) => x !== -1));
  const check = async () => {
    const before = result.view.attempts;
    const r = await send({ grid });
    if (r && !r.finished && r.view.attempts > before) setError("Noch nicht ganz. Schau nach doppelten Buchstaben.");
    if (r?.finished)
      try {
        localStorage.removeItem(key);
      } catch {}
  };

  return (
    <div className="mt-6">
      {v.hint && (
        <p className="mb-4 rounded-2xl bg-table-2 p-4">
          <span className="block text-sm font-bold text-ink-2">Das gesuchte Wort bedeutet</span>
          <span className="lex-italic text-lg">{v.hint}</span>
        </p>
      )}
      <div className="card-stock mx-auto w-full max-w-sm p-2">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${v.n}, minmax(0, 1fr))` }} role="grid" aria-label={`Sudoku ${v.n} mal ${v.n}`}>
          {grid.map((row, r) =>
            row.map((x, c) => {
              const given = v.givens[r][c] !== -1;
              const isSel = sel?.[0] === r && sel?.[1] === c;
              const borders = `${c % v.bc === 0 && c ? "border-l-2 border-l-[var(--card-ink)]" : ""} ${r % v.br === 0 && r ? "border-t-2 border-t-[var(--card-ink)]" : ""}`;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  role="gridcell"
                  aria-label={`Zeile ${r + 1}, Spalte ${c + 1}: ${x === -1 ? "leer" : v.letters[x]}${given ? " (vorgegeben)" : ""}`}
                  onClick={() => setSel([r, c])}
                  className={`condensed flex aspect-square items-center justify-center border border-[var(--card-line)] text-2xl uppercase ${borders} ${
                    r === v.row ? "bg-[var(--card-2)]" : ""
                  } ${isSel ? "outline-[3px] outline-[var(--focus)] -outline-offset-[3px]" : ""} ${given ? "font-extrabold text-[var(--card-ink)]" : "font-medium text-[var(--card-ink-2)]"} ${
                    bad.has(`${r},${c}`) && !given ? "!text-no" : ""
                  }`}
                >
                  {x === -1 ? "" : v.letters[x]}
                </button>
              );
            }),
          )}
        </div>
      </div>
      <p className="hint mt-2 text-center">Die grau hinterlegte Zeile ergibt das Wort.</p>

      {!result.finished && (
        <>
          <div className="mx-auto mt-4 flex max-w-sm flex-wrap justify-center gap-1.5" aria-label="Buchstaben">
            {v.letters.map((l, i) => (
              <button key={l} type="button" onClick={() => put(i)} className="h-12 min-w-12 flex-1 rounded-lg border-2 border-line bg-table-2 text-xl font-bold">
                {l}
              </button>
            ))}
            <button type="button" aria-label="Feld leeren" onClick={() => put(-1)} className="btn btn-quiet btn-sm !min-h-12">
              <Delete size={18} aria-hidden />
            </button>
          </div>
          <MoveError error={error} />
          <div className="mt-4 text-center">
            <button type="button" className="btn btn-primary" onClick={check} disabled={!full || pending}>
              Prüfen
            </button>
          </div>
        </>
      )}

      {result.finished && v.solution && (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-lg font-bold">Gelöst{result.durationMs != null ? ` in ${time(result.durationMs)}` : ""}!</p>
          <p>
            Das Wort:{" "}
            <Link href={`/wort/${v.solution.slug}`} className="display text-3xl hover:underline">
              {v.solution.term}
            </Link>
          </p>
          <ShareButton text={`Peake Buchstaben-Sudoku ${dayLabel(day)}: gelöst${result.durationMs != null ? ` in ${time(result.durationMs)}` : ""}`} />
        </div>
      )}
    </div>
  );
}
