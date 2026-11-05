import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/access";
import { GAMES } from "@/lib/games";
import { loadPlay } from "@/lib/puzzles/play";
import { isPuzzle } from "@/lib/puzzles/registry";
import { berlinDay, formatDate } from "@/lib/time";
import { Wortjagd } from "../_games/Wortjagd";
import { Quartett } from "../_games/Quartett";
import { Bedeutung } from "../_games/Bedeutung";
import { Sudoku } from "../_games/Sudoku";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game } = await params;
  return { title: isPuzzle(game) ? GAMES[game].title : "Minispiele", robots: { index: false } };
}

const NEEDS: Record<string, string> = {
  wortjagd: "Dafür braucht das Archiv ein Wort mit 4 bis 8 Buchstaben.",
  quartett: "Dafür braucht es vier Kategorien mit je mindestens vier eigenen Wörtern.",
  bedeutung: "Dafür braucht es mindestens fünf Wörter mit Bedeutung.",
  sudoku: "Dafür braucht es ein Wort mit 4 oder 6 verschiedenen Buchstaben.",
};

export default async function PuzzlePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!isPuzzle(game)) notFound();
  const v = await requireMemberPage();
  const day = berlinDay();
  const play = await loadPlay(db, game, v.id, day);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 pb-16 md:px-6 md:pt-10">
      <Link href="/spiele" className="text-sm font-semibold text-ink-2 hover:underline">
        ← Minispiele
      </Link>
      <h1 className="page-title mt-2">{GAMES[game].title}</h1>
      <p className="mt-2 text-ink-2">{GAMES[game].description}</p>
      <p className="mt-1 text-sm text-ink-3">{formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })} · jeden Tag ein neues Rätsel</p>

      {!play ? (
        <p className="mt-10 text-lg text-ink-3">Heute noch nicht spielbar. {NEEDS[game]}</p>
      ) : game === "wortjagd" ? (
        <Wortjagd initial={play as never} day={day} />
      ) : game === "quartett" ? (
        <Quartett initial={play as never} day={day} />
      ) : game === "bedeutung" ? (
        <Bedeutung initial={play as never} day={day} />
      ) : (
        <Sudoku initial={play as never} day={day} />
      )}
    </div>
  );
}
