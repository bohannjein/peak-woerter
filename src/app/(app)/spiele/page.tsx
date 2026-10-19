import Link from "next/link";
import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { GAMES, previousDay, roundResult, todaysRound, winsByUser } from "@/lib/games";
import { berlinDay, formatDate } from "@/lib/time";
import { SentenceForm, VoteButton } from "./client";

export const metadata: Metadata = { title: "Minispiele", robots: { index: false } };
export const dynamic = "force-dynamic";

const wordSelect = { term: true, slug: true, isPublic: true, definitions: { take: 1, orderBy: { position: "asc" as const }, select: { text: true } } };

export default async function Spiele() {
  const v = await requireMemberPage();
  const today = berlinDay();
  const yesterday = previousDay(today);
  const [round, settings] = await Promise.all([todaysRound(db), getSettings(db)]);
  if (!round) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
        <h1 className="page-title">Minispiele</h1>
        <p className="mt-10 text-lg text-ink-3">Sobald Wörter im Archiv sind, geht’s los.</p>
      </div>
    );
  }
  const [word, mine, prev, finished, wins, users] = await Promise.all([
    db.word.findUnique({ where: { id: round.wordId }, select: wordSelect }),
    db.gameEntry.findUnique({ where: { roundId_userId: { roundId: round.id, userId: v.id } } }),
    db.gameRound.findUnique({
      where: { game_day: { game: "satz", day: yesterday } },
      include: { word: { select: wordSelect }, entries: { orderBy: { id: "asc" } }, votes: { where: { voterId: v.id } } },
    }),
    db.gameRound.findMany({ where: { game: "satz", day: { lt: yesterday } }, orderBy: { day: "desc" }, take: 5, include: { word: { select: wordSelect } } }),
    winsByUser(db),
    db.user.findMany({ where: { disabled: false }, select: { id: true, name: true } }),
  ]);
  const results = await Promise.all(finished.map(async (r) => ({ r, entries: await roundResult(db, r.id) })));
  const board = users.map((u) => ({ ...u, wins: wins.get(u.id) ?? 0 })).filter((u) => u.wins > 0).sort((a, b) => b.wins - a.wins);
  const myVote = prev?.votes[0]?.entryId;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">{GAMES.satz.title}</h1>
      <p className="mt-2 text-ink-2">{GAMES.satz.description}</p>

      <section className="mt-8" aria-labelledby="heute">
        <h2 id="heute" className="section-title">
          Heute, {formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        <div className="card-stock band-cobalt mt-4 overflow-hidden">
          <p className="condensed flex h-8 items-center px-5 text-[0.72rem] font-extrabold uppercase tracking-[0.08em]" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
            Dein Wort
          </p>
          <div className="px-5 py-5 text-[var(--card-ink)]">
            <p className="display text-[2.4rem]">{word?.isPublic ? <Link href={`/wort/${word.slug}`}>{word.term}</Link> : word?.term}</p>
            {word?.definitions[0] && <p className="mt-1 text-[var(--card-ink-2)]">{word.definitions[0].text}</p>}
          </div>
        </div>
        {mine ? (
          <p className="mt-5 rounded-2xl bg-table-2 p-4">
            <span className="block text-sm font-bold text-ink-2">Dein Satz</span>
            {mine.text ?? (mine.audioPath && <audio src={`/api/spiel/${mine.id}`} controls preload="none" className="mt-2 h-10" />)}
            <span className="mt-2 block text-sm text-ink-3">Morgen wird abgestimmt.</span>
          </p>
        ) : (
          <SentenceForm voice={settings.gameVoice} />
        )}
      </section>

      {prev && prev.entries.length > 0 && (
        <section className="mt-12" aria-labelledby="gestern">
          <h2 id="gestern" className="section-title">
            Abstimmung: gestern mit „{prev.word.term}“
          </h2>
          <p className="mt-1 text-sm text-ink-2">Welcher Satz ist am besten? Namen gibt’s erst morgen. Eine Stimme, nicht für dich selbst.</p>
          <ul className="mt-4 space-y-3">
            {prev.entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[1.5px] border-line p-4">
                <span className="min-w-0 flex-1">
                  {e.text ? <span className="lex-italic text-lg">„{e.text}“</span> : <audio src={`/api/spiel/${e.id}`} controls preload="none" className="h-10" />}
                </span>
                {e.userId === v.id ? (
                  <span className="text-sm text-ink-3">dein Satz</span>
                ) : myVote === e.id ? (
                  <span className="rounded-full bg-yes px-3 py-1 text-sm font-bold text-white">Deine Stimme</span>
                ) : (
                  !myVote && <VoteButton entryId={e.id} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.length > 0 && (
        <section className="mt-12" aria-labelledby="ergebnisse">
          <h2 id="ergebnisse" className="section-title">
            Ergebnisse
          </h2>
          <ol className="mt-3">
            {results.map(({ r, entries }) => (
              <li key={r.id} className="border-t border-line py-4">
                <p className="text-sm text-ink-3">
                  {formatDate(`${r.day}T12:00:00Z`, { weekday: "short", day: "numeric", month: "short" })} · „{r.word.term}“
                </p>
                {entries.filter((e) => e.won).length === 0 ? (
                  <p className="mt-1 text-ink-3">{entries.length ? "Keine Stimmen." : "Niemand hat mitgespielt."}</p>
                ) : (
                  entries
                    .filter((e) => e.won)
                    .map((e) => (
                      <p key={e.id} className="mt-1">
                        <Trophy size={15} className="mr-1 inline align-[-2px]" aria-hidden />
                        <Link href={`/profil/${e.user.id}`} className="font-bold hover:underline">
                          {e.user.name}
                        </Link>
                        {e.text ? <span className="lex-italic text-ink-2"> „{e.text}“</span> : " (Aufnahme)"} <span className="tabular text-sm text-ink-3">· {e.votes} Stimmen</span>
                      </p>
                    ))
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {board.length > 0 && (
        <section className="mt-12" aria-labelledby="bestenliste">
          <h2 id="bestenliste" className="section-title">
            Bestenliste
          </h2>
          <ol className="mt-3">
            {board.map((u, i) => (
              <li key={u.id} className="flex justify-between border-b border-line/70 py-2">
                <Link href={`/profil/${u.id}`} className="font-semibold hover:underline">
                  {i + 1}. {u.name}
                </Link>
                <span className="tabular">{u.wins}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
