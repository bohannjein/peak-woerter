import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle, Users } from "lucide-react";
import { laterWords } from "@/lib/later";
import { requireStaffPage } from "@/lib/access";
import { formatDate } from "@/lib/time";
import { VOTE_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Später", robots: { index: false } };
export const dynamic = "force-dynamic";

const tone = { YES: "bg-yes text-white", NO: "bg-no text-white", LATER: "bg-later text-later-ink" } as const;

export default async function Spaeter() {
  await requireStaffPage();
  const words = await laterWords();

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Später</h1>
      {words.length > 0 && (
        <Link href="/k/runde" className="btn btn-primary btn-sm mt-4">
          <Users size={17} aria-hidden /> Gemeinsam durchgehen
        </Link>
      )}

      {words.length === 0 ? (
        <p className="mt-12 text-lg text-ink-3">Leer.</p>
      ) : (
        <ul className="mt-8">
          {words.map((w) => {
            const last = w.rounds[0];
            return (
              <li key={w.id} className="border-t border-line">
                <Link href={`/k/wort/${w.id}`} className="group block py-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="display text-[2rem] group-hover:underline decoration-2 underline-offset-4">{w.term}</span>
                    <span className="shrink-0 text-sm text-ink-3">seit {formatDate(w.createdAt, { day: "numeric", month: "short" })}</span>
                  </div>
                  {w.definitions[0] && <p className="mt-1 text-ink-2">{w.definitions[0].text}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    {last?.votes
                      .sort((a, b) => a.seat - b.seat)
                      .map((v) => (
                        <span key={v.id} className={`rounded-full px-2.5 py-1 font-bold ${tone[v.value]}`}>
                          {v.user.name.split(" ")[0]}: {VOTE_LABEL[v.value]}
                        </span>
                      ))}
                    {w._count.rounds > 1 && <span className="text-ink-3">{w._count.rounds} Runden</span>}
                    <span className="inline-flex items-center gap-1 text-ink-2">
                      <MessageCircle size={15} aria-hidden /> {w._count.comments}
                    </span>
                  </div>
                  {w.comments[0] && (
                    <p className="mt-2 line-clamp-2 text-[0.95rem] text-ink-2">
                      <strong className="text-ink">{w.comments[0].user.name.split(" ")[0]}:</strong> {w.comments[0].body}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
