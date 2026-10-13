"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Slide = {
  tone: "ink" | "card" | "yes" | "no" | "later";
  big?: string;
  title: string;
  text?: string;
  list?: string[];
  words?: { term: string; slug: string }[];
};

const TONES: Record<Slide["tone"], React.CSSProperties> = {
  ink: { background: "#12141c", color: "#f4f3ec" },
  card: { background: "var(--card)", color: "var(--card-ink)" },
  yes: { background: "var(--yes)", color: "#fff" },
  no: { background: "var(--no)", color: "#fff" },
  later: { background: "var(--later)", color: "var(--later-ink)" },
};

/** Tap right/left (or arrow keys) to move through the year, like a story. */
export function Story({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const go = (d: number) => setI((x) => Math.min(Math.max(x + d, 0), slides.length - 1));
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const s = slides[i];

  return (
    <div className="mx-auto max-w-md px-4 pt-4">
      <h1 className="sr-only">Peake Wrapped</h1>
      <div className="flex gap-1" aria-hidden>
        {slides.map((_, j) => (
          <span key={j} className={`h-1 flex-1 rounded-full ${j <= i ? "bg-ink" : "bg-line"}`} />
        ))}
      </div>
      <section
        key={i}
        aria-live="polite"
        aria-roledescription="Folie"
        aria-label={`${i + 1} von ${slides.length}`}
        className="toast-in relative mt-3 flex h-[calc(100dvh-12rem-env(safe-area-inset-bottom))] max-h-[44rem] min-h-[28rem] flex-col justify-end overflow-hidden rounded-[24px] p-7"
        style={TONES[s.tone]}
      >
        <button type="button" onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/3" aria-label="Zurück" disabled={i === 0} />
        <button type="button" onClick={() => go(1)} className="absolute inset-y-0 right-0 w-2/3" aria-label="Weiter" disabled={i === slides.length - 1} />
        <div className="pointer-events-none relative">
          {s.big && <p className="display break-words text-[clamp(4rem,22vw,8rem)] uppercase">{s.big}</p>}
          <p className={`display uppercase ${s.big ? "mt-2 text-[2rem]" : "text-[2.75rem]"}`}>{s.title}</p>
          {s.text && <p className="mt-3 text-lg leading-snug opacity-85">{s.text}</p>}
          {s.list && (
            <ol className="mt-5 space-y-1.5">
              {s.list.map((l, j) => (
                <li key={l} className="flex items-baseline gap-3 text-xl font-semibold">
                  <span className="display tabular w-6 opacity-60">{j + 1}</span> {l}
                </li>
              ))}
            </ol>
          )}
        </div>
        {s.words && (
          <ul className="relative mt-5 flex max-h-[55%] flex-wrap gap-2 overflow-y-auto">
            {s.words.map((w) => (
              <li key={w.slug}>
                <Link href={`/wort/${w.slug}`} className="inline-block rounded-full bg-white/12 px-3 py-1.5 font-semibold hover:bg-white/25">
                  {w.term}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="mt-4 flex items-center justify-between">
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => go(-1)} disabled={i === 0}>
          <ChevronLeft size={18} aria-hidden /> Zurück
        </button>
        <span className="tabular text-sm text-ink-3">
          {i + 1} / {slides.length}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => go(1)} disabled={i === slides.length - 1}>
          Weiter <ChevronRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
