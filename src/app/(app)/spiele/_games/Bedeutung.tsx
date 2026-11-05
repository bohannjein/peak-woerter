"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import type { PlayResult } from "@/lib/puzzles/play";
import { dayLabel, MoveError, ShareButton, useMove } from "./common";

export function Bedeutung({ initial, day }: { initial: PlayResult<"bedeutung">; day: string }) {
  const { result, error, pending, send } = useMove("bedeutung", initial);
  const v = result.view;
  const last = v.done.at(-1);

  return (
    <div className="mt-6">
      <p className="tabular text-sm font-semibold text-ink-2">
        {v.current ? `Frage ${v.done.length + 1} von ${v.total}` : `${v.score} von ${v.total} richtig`}
      </p>

      {last && v.current && (
        <p className={`mt-3 rounded-xl px-4 py-3 font-medium ${last.chosen === last.correct ? "bg-yes/10" : "bg-no/10"}`} role="status">
          {last.chosen === last.correct ? "Richtig!" : `Leider nicht. „${last.term}“ heißt: ${last.options[last.correct]}`}
        </p>
      )}

      {v.current && (
        <>
          <div className="card-stock band-ink mt-4 overflow-hidden">
            <p className="condensed flex h-8 items-center px-5 text-[0.72rem] font-extrabold uppercase tracking-[0.08em]" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
              Was bedeutet
            </p>
            <p className="display px-5 py-5 text-[2.4rem] text-[var(--card-ink)]">{v.current.term}</p>
          </div>
          <ul className="mt-4 space-y-2">
            {v.current.options.map((o, i) => (
              <li key={i}>
                <button type="button" disabled={pending} onClick={() => send({ choice: i })} className="lex-italic w-full rounded-2xl border-[1.5px] border-line bg-table-2 p-4 text-left text-lg hover:border-ink-3 disabled:opacity-60">
                  {o}
                </button>
              </li>
            ))}
          </ul>
          <MoveError error={error} />
        </>
      )}

      {!v.current && (
        <>
          <ol className="mt-4 space-y-3">
            {v.done.map((q) => {
              const ok = q.chosen === q.correct;
              return (
                <li key={q.slug} className="rounded-2xl border-[1.5px] border-line p-4">
                  <p className="flex items-center gap-2 font-bold">
                    {ok ? <Check size={18} className="text-yes" aria-label="richtig" /> : <X size={18} className="text-no" aria-label="falsch" />}
                    <Link href={`/wort/${q.slug}`} className="hover:underline">
                      {q.term}
                    </Link>
                  </p>
                  <p className="lex-italic mt-1">{q.options[q.correct]}</p>
                  {!ok && <p className="mt-1 text-sm text-ink-3">Deine Wahl: {q.options[q.chosen]}</p>}
                </li>
              );
            })}
          </ol>
          <div className="mt-6 text-center">
            <ShareButton text={`Peake Echt oder erfunden? ${dayLabel(day)}: ${v.score}/${v.total}\n${v.done.map((q) => (q.chosen === q.correct ? "✅" : "❌")).join("")}`} />
          </div>
        </>
      )}
    </div>
  );
}
