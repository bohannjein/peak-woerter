import Link from "next/link";
import type { Metadata } from "next";
import { Check, Flame } from "lucide-react";
import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/access";
import { GAMES, todaysRound } from "@/lib/games";
import { puzzleStats } from "@/lib/puzzles/play";
import { groupCounts } from "@/lib/puzzles/group";
import { PUZZLES, type PuzzleKey } from "@/lib/puzzles/registry";
import { berlinDay } from "@/lib/time";
import { PushToggle } from "@/components/PushToggle";

export const metadata: Metadata = { title: "Minispiele", robots: { index: false } };
export const dynamic = "force-dynamic";

const BAND: Record<PuzzleKey, string> = { wortjagd: "band-grass", quartett: "band-cobalt", bedeutung: "band-magenta", sudoku: "band-sun" };

export default async function Spiele() {
  const v = await requireMemberPage();
  const today = berlinDay();
  const keys = Object.keys(PUZZLES) as PuzzleKey[];
  const [stats, rounds, satz, counts] = await Promise.all([
    puzzleStats(db, v.id, today),
    Promise.all(keys.map((k) => todaysRound(db, k, today))),
    db.gameRound.findUnique({ where: { game_day: { game: "satz", day: today } }, select: { entries: { where: { userId: v.id }, select: { id: true } } } }),
    groupCounts(db, today),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 md:px-6 md:pt-10">
      <h1 className="page-title">Minispiele</h1>
      <p className="mt-2 text-ink-2">Jeden Tag neue Rätsel aus unserem Archiv. Für alle dieselben.</p>

      <PushToggle />

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {keys.map((k, i) => {
          const s = stats.games[k];
          const available = !!rounds[i]?.puzzle;
          return (
            <li key={k}>
              <Link href={`/spiele/${k}`} className={`card-stock ${BAND[k]} block h-full overflow-hidden transition-transform hover:-translate-y-0.5`}>
                <p className="condensed flex h-8 items-center justify-between px-5 text-[0.72rem] font-extrabold uppercase tracking-[0.08em]" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
                  <span>Täglich</span>
                  {s.today !== "open" && (
                    <span className="flex items-center gap-1">
                      <Check size={14} aria-hidden /> {s.today === "won" ? "Gelöst" : "Gespielt"}
                    </span>
                  )}
                </p>
                <div className="px-5 py-4 text-[var(--card-ink)]">
                  <p className="display text-[1.9rem]">{GAMES[k].title}</p>
                  <p className="mt-1 text-sm text-[var(--card-ink-2)]">{available ? GAMES[k].description : "Heute noch nicht spielbar, es fehlen passende Wörter."}</p>
                  {(s.streak > 0 || counts[k]) && (
                    <p className="tabular mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {s.streak > 0 && (
                        <span className="flex items-center gap-1 font-semibold">
                          <Flame size={15} aria-hidden /> {s.streak} {s.streak === 1 ? "Tag" : "Tage"} in Folge
                        </span>
                      )}
                      {counts[k] && (
                        <span className="text-[var(--card-ink-2)]">
                          Gruppe: {counts[k].won} von {counts[k].finished} gelöst
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/spiele/satz" className="card-stock band-ink block h-full overflow-hidden transition-transform hover:-translate-y-0.5">
            <p className="condensed flex h-8 items-center justify-between px-5 text-[0.72rem] font-extrabold uppercase tracking-[0.08em]" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
              <span>Mit Abstimmung</span>
              {!!satz?.entries.length && (
                <span className="flex items-center gap-1">
                  <Check size={14} aria-hidden /> Abgegeben
                </span>
              )}
            </p>
            <div className="px-5 py-4 text-[var(--card-ink)]">
              <p className="display text-[1.9rem]">{GAMES.satz.title}</p>
              <p className="mt-1 text-sm text-[var(--card-ink-2)]">{GAMES.satz.description}</p>
            </div>
          </Link>
        </li>
      </ul>

      {stats.played > 0 && (
        <p className="tabular mt-8 text-sm text-ink-3">
          Bisher {stats.played} Rätsel gespielt, {stats.won} gelöst.
        </p>
      )}
    </div>
  );
}
