"use client";

import Link from "next/link";
import { useState } from "react";
import { Shuffle } from "lucide-react";
import { bandClass } from "@/lib/categories";
import type { PlayResult } from "@/lib/puzzles/play";
import { MAX_MISTAKES, type Feedback } from "@/lib/puzzles/quartett";
import { dayLabel, MoveError, ShareButton, useMove } from "./common";

const FEEDBACK: Record<Exclude<Feedback, null>, string> = {
  richtig: "Richtig!",
  knapp: "Eins daneben.",
  falsch: "Leider nicht.",
  doppelt: "Das hattest du schon.",
};

export function Quartett({ initial, day }: { initial: PlayResult<"quartett">; day: string }) {
  const { result, error, pending, send } = useMove("quartett", initial);
  const v = result.view;
  const [selected, setSelected] = useState<number[]>([]);
  const [order, setOrder] = useState<number[] | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const tiles = order ? order.map((i) => v.tiles.find((t) => t.index === i)).filter((t) => !!t) : v.tiles;
  const toggle = (i: number) => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < 4 ? [...s, i] : s));
  const submit = async () => {
    const r = await send({ tiles: selected });
    if (!r) return;
    setFeedback(r.view.last);
    if (r.view.last === "richtig") setSelected([]);
  };
  const shuffle = () => setOrder([...v.tiles.map((t) => t.index)].sort(() => Math.random() - 0.5));

  return (
    <div className="mt-6">
      <div className="space-y-2">
        {v.solved.map((g) => (
          <div key={g.name} className={`card-stock ${bandClass(g.color)} overflow-hidden`}>
            <p className="condensed flex h-8 items-center px-4 text-[0.72rem] font-extrabold uppercase tracking-[0.08em]" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
              {g.name}
            </p>
            <p className="px-4 py-3 text-[var(--card-ink)]">
              {g.words.map((w, i) => (
                <span key={w.slug}>
                  {i > 0 && " · "}
                  <Link href={`/wort/${w.slug}`} className="font-semibold hover:underline">
                    {w.term}
                  </Link>
                </span>
              ))}
            </p>
          </div>
        ))}
      </div>

      {!result.finished && (
        <>
          <div className="mt-2 grid grid-cols-4 gap-2" role="group" aria-label="Wörter">
            {tiles.map((t) => {
              const on = selected.includes(t.index);
              return (
                <button
                  key={t.index}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(t.index)}
                  className={`flex min-h-16 items-center justify-center rounded-xl px-1.5 py-2 text-center text-[0.8rem] leading-tight font-bold break-words hyphens-auto transition-colors sm:text-sm ${
                    on ? "bg-ink text-table" : "card-stock"
                  }`}
                  lang="de"
                >
                  {t.term}
                </button>
              );
            })}
          </div>

          <p className="mt-4 flex items-center gap-2 text-sm text-ink-2" aria-live="polite">
            Fehler übrig:
            {Array.from({ length: MAX_MISTAKES }, (_, i) => (
              <span key={i} className={`inline-block size-3 rounded-full ${i < v.mistakesLeft ? "bg-ink" : "bg-table-3"}`} aria-hidden />
            ))}
            <span className="sr-only">{v.mistakesLeft}</span>
            {feedback && <span className="ml-auto font-bold text-ink">{FEEDBACK[feedback]}</span>}
          </p>
          <MoveError error={error} />

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-quiet btn-sm" onClick={shuffle}>
              <Shuffle size={16} aria-hidden /> Mischen
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setSelected([])} disabled={!selected.length}>
              Abwählen
            </button>
            <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={submit} disabled={selected.length !== 4 || pending}>
              Prüfen
            </button>
          </div>
        </>
      )}

      {result.finished && (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-lg font-bold">
            {result.won ? (result.score ? `Gelöst mit ${result.score} ${result.score === 1 ? "Fehler" : "Fehlern"}.` : "Fehlerfrei gelöst!") : "Keine Fehler mehr übrig. Oben stehen die Lösungen."}
          </p>
          <ShareButton text={`Peake Quartett ${dayLabel(day)}: ${result.won ? `gelöst, ${result.score ?? 0}/${MAX_MISTAKES} Fehler` : "nicht gelöst"}`} />
        </div>
      )}
    </div>
  );
}
