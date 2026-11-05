"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import type { PlayResult } from "@/lib/puzzles/play";
import type { Mark } from "@/lib/puzzles/wortjagd";
import { dayLabel, MoveError, ShareButton, useMove } from "./common";

const ROWS = ["qwertzuiop", "asdfghjkl", "yxcvbnm"];
// Umlaut keys type the folded spelling the answer uses.
const EXTRA: [string, string][] = [["ä", "ae"], ["ö", "oe"], ["ü", "ue"], ["ß", "ss"]];
const RANK: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };

const cell: Record<Mark | "empty" | "typed", string> = {
  hit: "bg-yes text-white border-yes",
  near: "bg-later text-later-ink border-later",
  miss: "bg-table-3 text-ink-2 border-table-3",
  typed: "border-ink-3 text-ink",
  empty: "border-line",
};

export function Wortjagd({ initial, day }: { initial: PlayResult<"wortjagd">; day: string }) {
  const { result, error, setError, pending, send } = useMove("wortjagd", initial);
  const v = result.view;
  const [typed, setTyped] = useState("");
  const done = result.finished;

  const keyMarks = new Map<string, Mark>();
  for (const r of v.rows)
    [...r.guess].forEach((ch, i) => {
      const m = r.marks[i];
      if (RANK[m] > RANK[keyMarks.get(ch) ?? "miss"] || !keyMarks.has(ch)) keyMarks.set(ch, m);
    });

  const press = (k: string) => {
    if (done || pending) return;
    setError(null);
    if (k === "enter") {
      if (typed.length !== v.length) return setError(`Das Wort hat ${v.length} Buchstaben.`);
      void send({ guess: typed }).then((r) => r && setTyped(""));
    } else if (k === "back") setTyped((t) => t.slice(0, -1));
    else setTyped((t) => (t + k).slice(0, v.length));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest("input, textarea")) return;
      const k = e.key.toLowerCase();
      if (k === "enter") press("enter");
      else if (k === "backspace") press("back");
      else if (/^[a-z]$/.test(k)) press(k);
      else {
        const x = EXTRA.find(([u]) => u === k);
        if (x) press(x[1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const rows = Array.from({ length: v.maxGuesses }, (_, i) => v.rows[i] ?? (i === v.rows.length && !done ? { guess: typed, marks: null } : { guess: "", marks: null }));
  const share = `Peake Wortjagd ${dayLabel(day)} ${result.won ? v.rows.length : "X"}/${v.maxGuesses}\n${v.rows.map((r) => r.marks.map((m) => (m === "hit" ? "🟩" : m === "near" ? "🟨" : "⬜")).join("")).join("\n")}`;

  return (
    <div className="mt-6">
      <div className="mx-auto grid w-fit gap-1.5" role="grid" aria-label="Versuche">
        {rows.map((r, i) => (
          <div key={i} role="row" className="flex gap-1.5">
            {Array.from({ length: v.length }, (_, j) => {
              const ch = r.guess[j] ?? "";
              const m = r.marks?.[j];
              return (
                <span
                  key={j}
                  role="gridcell"
                  aria-label={ch ? `${ch.toUpperCase()}${m ? `, ${m === "hit" ? "richtig" : m === "near" ? "kommt vor" : "kommt nicht vor"}` : ""}` : "leer"}
                  className={`condensed flex size-11 items-center justify-center rounded-lg border-2 text-2xl font-extrabold uppercase sm:size-13 ${cell[m ?? (ch ? "typed" : "empty")]}`}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <MoveError error={error} />

      {v.hint && (
        <p className="mt-5 rounded-2xl bg-table-2 p-4">
          <span className="block text-sm font-bold text-ink-2">Bedeutung</span>
          <span className="lex-italic text-lg">{v.hint}</span>
        </p>
      )}

      {done ? (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-lg font-bold">{result.won ? `Gefunden in ${v.rows.length} ${v.rows.length === 1 ? "Versuch" : "Versuchen"}.` : "Diesmal nicht."}</p>
          {v.solution && (
            <p>
              Das Wort:{" "}
              <Link href={`/wort/${v.solution.slug}`} className="display text-3xl hover:underline">
                {v.solution.term}
              </Link>
            </p>
          )}
          <ShareButton text={share} />
        </div>
      ) : (
        <div className="mx-auto mt-6 max-w-lg space-y-1.5 select-none" aria-label="Tastatur">
          {ROWS.map((row, i) => (
            <div key={row} className="flex justify-center gap-1">
              {i === 2 && (
                <button type="button" className="btn btn-primary btn-sm !min-h-12 !px-2 text-xs" onClick={() => press("enter")} disabled={pending}>
                  Raten
                </button>
              )}
              {[...row].map((k) => {
                const m = keyMarks.get(k);
                return (
                  <button key={k} type="button" onClick={() => press(k)} className={`h-12 min-w-0 flex-1 rounded-lg border-2 font-bold uppercase ${m ? cell[m] : "border-line bg-table-2"}`}>
                    {k}
                  </button>
                );
              })}
              {i === 2 && (
                <button type="button" aria-label="Löschen" className="btn btn-quiet btn-sm !min-h-12 !px-2" onClick={() => press("back")}>
                  <Delete size={18} aria-hidden />
                </button>
              )}
            </div>
          ))}
          <div className="flex justify-center gap-1">
            {EXTRA.map(([u, f]) => (
              <button key={u} type="button" onClick={() => press(f)} className="h-11 w-14 rounded-lg border-2 border-line bg-table-2 font-bold" aria-label={`${u} (${f})`}>
                {u}
              </button>
            ))}
          </div>
          <p className="hint text-center">Umlaute zählen als zwei Buchstaben: ä = ae, ß = ss.</p>
        </div>
      )}
    </div>
  );
}
