"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowBigDown, ArrowBigUp, Loader2, Undo2 } from "lucide-react";
import { electionVoteAction, retractElectionVoteAction } from "@/app/actions/elections";

export function BallotRow({
  electionId,
  word,
  stage,
  mine,
  canUp,
  canDown,
  meta,
}: {
  electionId: string;
  word: { id: string; term: string; slug: string };
  stage: number;
  mine: number;
  canUp: boolean;
  canDown: boolean;
  meta?: string;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setErr(r.ok ? null : (r.error ?? "Fehler."));
    });
  const btn = "grid size-11 place-items-center rounded-full border-[1.5px] border-line transition-colors disabled:opacity-35";

  return (
    <li className="border-b border-line/70 py-2">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <Link href={`/wort/${word.slug}`} className="display text-[1.4rem] hover:underline">
            {word.term}
          </Link>
          {meta && <span className="ml-2 text-sm text-ink-3">{meta}</span>}
        </span>
        {pending && <Loader2 className="animate-spin" size={18} aria-label="Speichert" />}
        {mine !== 0 ? (
          <>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${mine > 0 ? "bg-yes text-white" : "bg-no text-white"}`}>
              {stage === 1 ? "nominiert" : mine > 0 ? "Upvote" : "Downvote"}
            </span>
            <button type="button" className={btn} disabled={pending} aria-label={`Stimme für ${word.term} zurücknehmen`} onClick={() => run(() => retractElectionVoteAction(electionId, word.id))}>
              <Undo2 size={18} aria-hidden />
            </button>
          </>
        ) : stage === 1 ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={pending || !canUp} onClick={() => run(() => electionVoteAction(electionId, word.id, 1))}>
            Nominieren
          </button>
        ) : (
          <>
            <button type="button" className={`${btn} hover:border-yes hover:text-yes`} disabled={pending || !canUp} aria-label={`Upvote für ${word.term}`} onClick={() => run(() => electionVoteAction(electionId, word.id, 1))}>
              <ArrowBigUp size={22} aria-hidden />
            </button>
            <button type="button" className={`${btn} hover:border-no hover:text-no`} disabled={pending || !canDown} aria-label={`Downvote für ${word.term}`} onClick={() => run(() => electionVoteAction(electionId, word.id, -1))}>
              <ArrowBigDown size={22} aria-hidden />
            </button>
          </>
        )}
      </div>
      {err && (
        <p role="alert" className="mt-1 text-sm font-semibold text-no">
          {err}
        </p>
      )}
    </li>
  );
}
