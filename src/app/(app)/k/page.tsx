import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, Inbox, Plus, Settings, Sparkles, UserCog, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { formatDate, berlinYear } from "@/lib/time";
import { cardNo } from "@/lib/categories";

export const metadata: Metadata = { title: "Übersicht", robots: { index: false } };
export const dynamic = "force-dynamic";

function List({ title, empty, items, href }: { title: string; empty: string; items: { id: string; term: string; meta?: string }[]; href?: string }) {
  return (
    <section className="border-t border-line pt-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {href && items.length > 0 && (
          <Link href={href} className="text-sm font-semibold text-ink-2 hover:text-ink">
            Alle
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-2">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/k/wort/${i.id}`} className="group flex items-baseline justify-between gap-3 py-2">
                <span className="display text-2xl group-hover:underline decoration-2 underline-offset-4">{i.term}</span>
                {i.meta && <span className="shrink-0 text-sm text-ink-3">{i.meta}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function Overview() {
  const v = await requireStaffPage();
  if (!v.seat) redirect("/admin");
  const seat = v.seat;

  const [mine, waiting, later, reviews, inbox, recent] = await Promise.all([
    db.votingRound.findMany({
      where: { closedAt: null, votes: { none: { seat } } },
      select: { word: { select: { id: true, term: true } }, kind: true },
      orderBy: { openedAt: "asc" },
    }),
    db.votingRound.findMany({
      where: { closedAt: null, votes: { some: { seat } } },
      select: { word: { select: { id: true, term: true } } },
      orderBy: { openedAt: "desc" },
      take: 5,
    }),
    db.word.findMany({ where: { status: "LATER" }, select: { id: true, term: true, _count: { select: { comments: true } } }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.votingRound.findMany({ where: { closedAt: null, kind: "REVIEW" }, select: { word: { select: { id: true, term: true } } } }),
    db.submission.count({ where: { status: "NEW" } }),
    db.word.findMany({ where: { isPublic: true }, select: { id: true, term: true, cardNumber: true, acceptedAt: true }, orderBy: { acceptedAt: "desc" }, take: 5 }),
  ]);
  const laterCount = await db.word.count({ where: { status: "LATER" } });

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Hallo {v.name.split(" ")[0]}.</h1>

      {mine.length > 0 ? (
        <Link href="/k/abstimmen" className="group mt-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10" aria-label={`Abstimmen: ${mine.length} ${mine.length === 1 ? "Karte" : "Karten"} im Stapel`}>
          {/* The waiting words as a small physical stack, top card readable. */}
          <span className="relative block h-40 w-60 shrink-0" aria-hidden>
            {mine.length > 2 && <span className="card-stock absolute inset-0 translate-x-3 translate-y-3 rotate-[4deg]" />}
            {mine.length > 1 && <span className="card-stock absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-[2deg]" />}
            <span className="card-stock band-ink absolute inset-0 flex flex-col overflow-hidden transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-hover:-rotate-1">
              <span className="condensed flex h-8 items-center px-4 text-[0.72rem] font-extrabold uppercase tracking-[0.08em]" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
                {mine[0].kind === "REVIEW" ? "Neubewertung" : "Neu"}
              </span>
              <span className="display truncate px-4 pt-4 text-[2rem]">{mine[0].word.term}</span>
            </span>
          </span>
          <span>
            <span className="display block text-[clamp(1.5rem,4vw,2.25rem)]">
              <span className="tabular">{mine.length}</span> {mine.length === 1 ? "Karte" : "Karten"} im Stapel
            </span>
            <span className="mt-2 inline-flex items-center gap-2 font-semibold text-ink-2 group-hover:text-ink">
              Abstimmen <ArrowRight size={18} aria-hidden />
            </span>
          </span>
        </Link>
      ) : (
        <div className="mt-8 flex flex-col gap-4 rounded-[20px] border-2 border-dashed border-line p-6 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="section-title block">Alles abgestimmt.</span>
                      </p>
          <Link href="/k/neu" className="btn btn-primary">
            <Plus size={18} aria-hidden /> Wort hinzufügen
          </Link>
        </div>
      )}

      <div className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
        <List title="Wartet auf weitere Stimmen" empty="Keine." items={waiting.map((w) => ({ id: w.word.id, term: w.word.term }))} />
        <List
          title={`Später-Liste${laterCount ? ` (${laterCount})` : ""}`}
          empty="Keine."
          href="/k/spaeter"
          items={later.map((w) => ({ id: w.id, term: w.term, meta: w._count.comments ? `${w._count.comments} Kommentar${w._count.comments === 1 ? "" : "e"}` : undefined }))}
        />
        <List title="Laufende Anfechtungen" empty="Keine." items={reviews.map((r) => ({ id: r.word.id, term: r.word.term }))} />
        <List
          title="Zuletzt aufgenommen"
          empty="Keine."
          items={recent.map((w) => ({ id: w.id, term: w.term, meta: [cardNo(w.cardNumber), w.acceptedAt && formatDate(w.acceptedAt, { day: "numeric", month: "short" })].filter(Boolean).join(" · ") }))}
        />
      </div>

      <nav aria-label="Weitere Bereiche" className="mt-12 flex flex-wrap gap-2 border-t border-line pt-6">
        {laterCount > 0 && (
          <Link href="/k/runde" className="chip">
            <Users size={16} aria-hidden /> Diskussionsrunde
          </Link>
        )}
        <Link href="/k/kategorien" className="chip">
          Kategorien
        </Link>
        <Link href="/pflege" className="chip">
          Datenbank pflegen
        </Link>
        <Link href="/spiele" className="chip">
          Minispiele
        </Link>
        <Link href="/wort-des-jahres" className="chip">
          Wort des Jahres
        </Link>
        <Link href="/k/negativliste" className="chip">
          Negativliste
        </Link>
        <Link href={`/wrapped/${berlinYear(new Date())}`} className="chip">
          <Sparkles size={16} aria-hidden /> Peake Wrapped
        </Link>
        <Link href="/konto" className="chip">
          <UserCog size={16} aria-hidden /> Konto
        </Link>
        {v.isAdmin && (
          <Link href="/admin" className="chip">
            <Settings size={16} aria-hidden /> Verwaltung
          </Link>
        )}
      </nav>
    </div>
  );
}
