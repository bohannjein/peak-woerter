import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireStaffPage } from "@/lib/access";
import { toCard } from "@/lib/cards";
import { VOTE_LABEL } from "@/lib/labels";
import { WordCard } from "@/components/WordCard";
import { CommentForm, RoundButton } from "@/components/WordActions";
import { laterWords } from "@/lib/later";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Diskussionsrunde", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Meeting mode: one big card at a time, for going through the Später list together. */
export default async function Runde({ searchParams }: { searchParams: Promise<{ i?: string }> }) {
  const v = await requireStaffPage();
  const words = await laterWords();
  if (words.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-16 text-center">
        <p className="page-title">Nichts zu besprechen.</p>
        <Link href="/k" className="btn btn-primary mt-6">
          Zur Übersicht
        </Link>
      </div>
    );
  }
  const i = Math.min(Math.max(Number((await searchParams).i) || 0, 0), words.length - 1);
  const w = words[i];
  const last = w.rounds[0];

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6">
      <div className="flex items-center justify-between">
        <Link href="/k/spaeter" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Später-Liste
        </Link>
        <p className="tabular text-sm font-bold" aria-live="polite">
          {i + 1} / {words.length}
        </p>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,26rem)_1fr] md:gap-12">
        <WordCard data={toCard(w, { showUnverified: true, bandLabel: "Zur Diskussion" })} headingLevel={1} className="min-h-[60dvh] md:min-h-[34rem]" />

        <div>
          {last && (
            <section>
              <h2 className="text-lg font-bold">Letzte Runde</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {last.votes
                  .sort((a, b) => a.seat - b.seat)
                  .map((x) => (
                    <li key={x.id} className="chip">
                      {x.user.name}: <strong>{VOTE_LABEL[x.value]}</strong>
                    </li>
                  ))}
              </ul>
            </section>
          )}
          <section className="mt-8">
            <h2 className="text-lg font-bold">Kommentare</h2>
            <ol className="mt-2 space-y-3">
              {w.comments.length === 0 && <li className="text-ink-3">Noch keine.</li>}
              {[...w.comments].reverse().map((c) => (
                <li key={c.id} className="rounded-2xl bg-table-2 px-4 py-3">
                  <p className="text-xs font-bold text-ink-2">
                    {c.user.name} · {formatDate(c.createdAt, { day: "numeric", month: "short" })}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{c.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-sm">
              <Link href={`/k/wort/${w.id}`} className="font-semibold underline">
                Verlauf
              </Link>
            </p>
            {v.seat && <CommentForm wordId={w.id} />}
          </section>
          <div className="mt-8 border-t border-line pt-6">
            <RoundButton wordId={w.id} kind="REVOTE" label="Neu abstimmen" />
          </div>
        </div>
      </div>

      <nav className="mt-8 flex justify-between gap-3 pb-6" aria-label="Wörter durchblättern">
        <Link href={`/k/runde?i=${i - 1}`} aria-disabled={i === 0} className={`btn btn-quiet ${i === 0 ? "pointer-events-none opacity-40" : ""}`}>
          <ArrowLeft size={18} aria-hidden /> Vorheriges
        </Link>
        <Link href={`/k/runde?i=${i + 1}`} aria-disabled={i === words.length - 1} className={`btn btn-primary ${i === words.length - 1 ? "pointer-events-none opacity-40" : ""}`}>
          Nächstes <ArrowRight size={18} aria-hidden />
        </Link>
      </nav>
    </div>
  );
}
