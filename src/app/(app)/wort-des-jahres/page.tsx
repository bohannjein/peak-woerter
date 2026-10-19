import Link from "next/link";
import type { Metadata } from "next";
import { Search, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { getGuest, getViewer } from "@/lib/access";
import { KIND_LABEL, STAGE_LABEL, ballot, decideElection, stageOf, standings, type Stage } from "@/lib/elections";
import { normalizeTerm } from "@/lib/text";
import { formatDate, berlinYear } from "@/lib/time";
import type { ElectionKind } from "@/generated/prisma/enums";
import { BallotRow } from "./BallotRow";

export const metadata: Metadata = { title: "Wort des Jahres", robots: { index: false } };
export const dynamic = "force-dynamic";

const when = (d: Date) => formatDate(d, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default async function WortDesJahres({ searchParams }: { searchParams: Promise<{ art?: string; q?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const guest = viewer ? null : await getGuest();
  // Guests only take part in the community vote.
  const kind: ElectionKind = !viewer || sp.art === "community" ? "COMMUNITY" : "JURY";
  const year = berlinYear(new Date());

  const current = await db.election.findUnique({ where: { kind_year: { kind, year } } });
  const e = current ? await decideElection(db, current.id) : null;
  const past = await db.election.findMany({
    where: { winnerWordId: { not: null }, ...(viewer ? {} : { kind: "COMMUNITY" }) },
    orderBy: [{ year: "desc" }, { kind: "asc" }],
    include: { winner: { select: { term: true, slug: true, isPublic: true } } },
  });

  const tab = (k: ElectionKind, label: string) => (
    <Link href={k === "JURY" ? "/wort-des-jahres" : "/wort-des-jahres?art=community"} className="chip" aria-current={kind === k ? "true" : undefined}>
      {label}
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">
        {KIND_LABEL[kind]} {year}
      </h1>
      {viewer && (
        <nav aria-label="Wahl" className="mt-4 flex gap-2">
          {tab("JURY", "Mitglieder")}
          {tab("COMMUNITY", "Community")}
        </nav>
      )}

      {!e ? (
        <p className="mt-10 text-lg text-ink-3">Für {year} ist noch keine Abstimmung geplant.</p>
      ) : (
        <Election e={e} voter={viewer ? { userId: viewer.id } : guest ? { guestId: guest.id } : null} q={sp.q} />
      )}

      {past.length > 0 && (
        <section className="mt-16" aria-labelledby="bisher">
          <h2 id="bisher" className="section-title border-b border-line pb-2">
            Bisherige Gewinner
          </h2>
          <ul>
            {past.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 border-b border-line/70 py-3">
                <span className="text-sm text-ink-3">
                  {p.year} · {KIND_LABEL[p.kind]}
                </span>
                {p.winner?.isPublic ? (
                  <Link href={`/wort/${p.winner.slug}`} className="display text-2xl hover:underline">
                    {p.winner.term}
                  </Link>
                ) : (
                  <span className="display text-2xl">{p.winner?.term}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

async function Election({
  e,
  voter,
  q,
}: {
  e: NonNullable<Awaited<ReturnType<typeof decideElection>>>;
  voter: { userId: string } | { guestId: string } | null;
  q?: string;
}) {
  const stage = stageOf(e) as Stage;
  const mine = voter && stage >= 1 && stage <= 3 ? await db.electionVote.findMany({ where: { electionId: e.id, stage, ...voter }, select: { wordId: true, value: true } }) : [];
  const myVote = (id: string) => mine.find((m) => m.wordId === id)?.value ?? 0;
  const limit = stage === 1 ? e.nominations : stage === 2 ? e.shortlistVotes : 1;
  const used = (v: number) => mine.filter((m) => m.value === v).length;

  const schedule = (
    <ol className="mt-4 grid gap-1 text-sm text-ink-2 sm:grid-cols-2">
      <li className={stage === 1 ? "font-bold text-ink" : ""}>1 Nominieren ab {when(e.nominateFrom)}</li>
      <li className={stage === 2 ? "font-bold text-ink" : ""}>2 Vorauswahl ab {when(e.shortlistFrom)}</li>
      <li className={stage === 3 ? "font-bold text-ink" : ""}>3 Finale ab {when(e.finalFrom)}</li>
      <li className={stage === 4 ? "font-bold text-ink" : ""}>Ergebnis am {when(e.endsAt)}</li>
    </ol>
  );

  if (stage === 4) {
    const winner = e.winnerWordId ? await db.word.findUnique({ where: { id: e.winnerWordId }, select: { term: true, slug: true, isPublic: true } }) : null;
    const s3 = await standings(db, e.id, 3);
    const finalists = await db.word.findMany({ where: { id: { in: [...s3.keys()] } }, select: { id: true, term: true } });
    return (
      <section className="mt-8">
        <p className="section-title">{STAGE_LABEL[4]}</p>
        {winner ? (
          <div className="card-stock band-sun mt-4 overflow-hidden">
            <p className="condensed flex h-9 items-center gap-2 px-5 text-[0.75rem] font-extrabold uppercase tracking-[0.08em]" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
              <Trophy size={15} aria-hidden /> {KIND_LABEL[e.kind]} {e.year}
            </p>
            <p className="display px-5 py-6 text-[clamp(2.5rem,9vw,4rem)] text-[var(--card-ink)]">
              {winner.isPublic ? <Link href={`/wort/${winner.slug}`}>{winner.term}</Link> : winner.term}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-ink-3">Es gab keine Stimmen.</p>
        )}
        {finalists.length > 0 && (
          <ol className="mt-6">
            {finalists
              .sort((a, b) => (s3.get(b.id)?.score ?? 0) - (s3.get(a.id)?.score ?? 0))
              .map((f) => (
                <li key={f.id} className="flex justify-between border-b border-line/70 py-2">
                  <span className="font-semibold">{f.term}</span>
                  <span className="tabular text-ink-2">{s3.get(f.id)?.score ?? 0}</span>
                </li>
              ))}
          </ol>
        )}
      </section>
    );
  }

  if (stage === 0) {
    return (
      <section className="mt-8">
        <p className="section-title">{STAGE_LABEL[0]}</p>
        {schedule}
      </section>
    );
  }

  // Stage 1: search the collection. Stage 2/3: fixed ballot.
  const ids = await ballot(db, e, stage);
  const nq = q ? normalizeTerm(q.slice(0, 100)) : "";
  const words = ids
    ? await db.word.findMany({ where: { id: { in: ids }, isPublic: true }, select: { id: true, term: true, slug: true }, orderBy: { normalized: "asc" } })
    : await db.word.findMany({
        where: { isPublic: true, OR: [{ id: { in: mine.map((m) => m.wordId) } }, ...(nq ? [{ normalized: { contains: nq } }] : [])] },
        select: { id: true, term: true, slug: true },
        orderBy: { normalized: "asc" },
        take: 40,
      });
  const nominations = stage === 2 ? await standings(db, e.id, 1) : null;

  return (
    <section className="mt-8">
      <p className="section-title">{STAGE_LABEL[stage]}</p>
      {schedule}
      {!voter ? (
        <p className="mt-6 text-ink-2">Zum Abstimmen bitte anmelden.</p>
      ) : (
        <p className="mt-6 font-semibold" aria-live="polite">
          {stage === 1
            ? `Noch ${limit - used(1)} von ${limit} Nominierungen frei.`
            : `Noch ${limit - used(1)} Upvote${limit === 1 ? "" : "s"} und ${limit - used(-1)} Downvote${limit === 1 ? "" : "s"} frei.`}
        </p>
      )}
      {stage === 1 && (
        <form className="mt-4 flex gap-2" role="search">
          {e.kind === "COMMUNITY" && <input type="hidden" name="art" value="community" />}
          <label htmlFor="wdj-q" className="sr-only">
            Wort suchen
          </label>
          <input id="wdj-q" name="q" type="search" defaultValue={q} placeholder="Wort aus dem Archiv suchen" className="field" autoComplete="off" />
          <button className="btn btn-primary shrink-0 px-4" aria-label="Suchen">
            <Search size={20} aria-hidden />
          </button>
        </form>
      )}
      <ul className="mt-4">
        {words.length === 0 && <li className="py-4 text-ink-3">{stage === 1 ? (q ? "Nichts gefunden." : "Suche ein Wort, das du nominieren willst.") : "Keine Kandidaten."}</li>}
        {words.map((w) => (
          <BallotRow
            key={w.id}
            electionId={e.id}
            word={w}
            stage={stage}
            mine={myVote(w.id)}
            canUp={!!voter && used(1) < limit}
            canDown={!!voter && stage > 1 && used(-1) < limit}
            meta={nominations ? `${nominations.get(w.id)?.votes ?? 0}× nominiert` : undefined}
          />
        ))}
      </ul>
    </section>
  );
}
