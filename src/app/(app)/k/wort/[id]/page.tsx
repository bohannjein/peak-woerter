import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/access";
import { can } from "@/lib/permissions";
import { PERMISSION_KEYS } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { toCard } from "@/lib/cards";
import { formatDate } from "@/lib/time";
import { WordCard } from "@/components/WordCard";
import { CommentForm, InlineVote, RoundButton } from "@/components/WordActions";
import { STATUS_LABEL, VOTE_LABEL, OUTCOME_LABEL, KIND_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Wort", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InternalWord({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireMemberPage();
  // Internal view (votes, discussion): curators, admins and members with any extra right.
  if (!PERMISSION_KEYS.some((p) => can(v, p))) redirect("/");
  const { id } = await params;
  const w = await db.word.findUnique({
    where: { id },
    include: {
      definitions: { orderBy: { position: "asc" } },
      pronunciations: { orderBy: { position: "asc" } },
      examples: { orderBy: { position: "asc" } },
      categories: { include: { category: true } },
      submittedBy: { select: { name: true } },
      rounds: { orderBy: { number: "desc" }, include: { votes: { include: { user: { select: { name: true } } } }, openedBy: { select: { name: true } } } },
      comments: { orderBy: { createdAt: "asc" }, include: { user: { select: { name: true } } } },
      _count: { select: { rounds: true } },
    },
  });
  if (!w) notFound();

  const open = w.rounds.find((r) => !r.closedAt);
  const myVote = open?.votes.find((x) => x.seat === v.seat);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6 md:pt-10">
      <Link href="/k" className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Übersicht
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-[22rem_1fr] md:gap-14">
        <div className="md:sticky md:top-24 md:self-start">
          <WordCard data={toCard(w, { showUnverified: true, bandLabel: STATUS_LABEL[w.status] })} headingLevel={1} className="min-h-[24rem]" />
          <div className="mt-5 flex flex-wrap gap-2">
            {can(v, "edit") && (
              <Link href={`/k/wort/${w.id}/bearbeiten`} className="btn btn-primary">
                <Pencil size={17} aria-hidden /> Eintrag bearbeiten
              </Link>
            )}
            {w.isPublic && (
              <Link href={`/wort/${w.slug}`} className="btn btn-quiet">
                <ExternalLink size={17} aria-hidden /> Eintrag ansehen
              </Link>
            )}
          </div>
        </div>

        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-ink px-3 py-1 font-bold text-table">{STATUS_LABEL[w.status]}</span>
            {open?.kind === "REVIEW" && <span className="rounded-full border-[1.5px] border-line px-3 py-1 font-semibold">Neubewertung läuft{w.isPublic ? "" : " · ausgeblendet"}</span>}
            <span className="text-ink-2">
              eingereicht {formatDate(w.createdAt)} {w.submittedBy ? `von ${w.submittedBy.name}` : w.source === "GUEST" ? `von ${w.guestName ?? "einem Gast"}` : ""}
            </span>
          </p>
          {w.submissionNote && (
            <blockquote className="mt-4 border-l-2 border-line pl-4 text-ink-2">
              <span className="font-semibold text-ink">Notiz:</span> {w.submissionNote}
            </blockquote>
          )}

          {open && v.seat && !myVote && (
            <section className="mt-8 rounded-[20px] bg-table-2 p-5">
              <h2 className="font-bold">Deine Stimme fehlt noch</h2>
              <InlineVote wordId={w.id} />
            </section>
          )}
          {open && myVote && (
            <p className="mt-8 rounded-[20px] bg-table-2 p-5">
              Deine Stimme: <strong>{VOTE_LABEL[myVote.value]}</strong> · andere Stimmen fehlen noch
            </p>
          )}
          {!open && (w.status === "LATER" || w.status === "REJECTED") && (v.seat || v.isAdmin || (w.status === "REJECTED" && can(v, "negative"))) && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <RoundButton wordId={w.id} kind="REVOTE" label={w.status === "REJECTED" ? "Erneut prüfen" : "Neue Abstimmungsrunde"} />
            </div>
          )}
          {!open && w.status === "ACCEPTED" && (
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <RoundButton wordId={w.id} kind="REVIEW" label="Anfechten" confirm="Wort anfechten? Es fliegt nur raus, wenn alle Kuratoren Nein sagen." />
            </div>
          )}

          <section className="mt-12" aria-labelledby="disk">
            <h2 id="disk" className="section-title">
              Diskussion
            </h2>
            {w.comments.length === 0 ? (
              <p className="mt-3 text-ink-3">Keine Kommentare.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {w.comments.map((c) => (
                  <li key={c.id} className={`max-w-[34rem] rounded-2xl px-4 py-3 ${c.userId === v.id ? "ml-auto bg-ink text-table" : "bg-table-2"}`}>
                    <p className="text-xs font-bold opacity-70">
                      {c.user.name} · {formatDate(c.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{c.body}</p>
                  </li>
                ))}
              </ol>
            )}
            {can(v, "context") && <CommentForm wordId={w.id} />}
          </section>

          <section className="mt-12" aria-labelledby="verlauf">
            <h2 id="verlauf" className="section-title">
              Abstimmungsverlauf
            </h2>
            <ol className="mt-4">
              {w.rounds.map((r) => (
                <li key={r.id} className="border-t border-line py-4">
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold">
                      Runde {r.number} · {KIND_LABEL[r.kind]}
                    </span>
                    <span className="text-sm text-ink-2">
                      {r.closedAt ? `${OUTCOME_LABEL[r.outcome!]} · ${formatDate(r.closedAt)}` : `offen seit ${formatDate(r.openedAt)}`}
                    </span>
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {r.votes.length === 0 && <li className="text-sm text-ink-3">noch keine Stimmen</li>}
                    {r.votes
                      .sort((a, b) => a.seat - b.seat)
                      .map((x) => (
                        <li key={x.id} className="chip">
                          {x.user.name}:{" "}
                          {/* While a round is open, the other curator's vote stays hidden to avoid bias. */}
                          {r.closedAt || x.seat === v.seat ? <strong>{VOTE_LABEL[x.value]}</strong> : <em className="text-ink-3">abgestimmt</em>}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
