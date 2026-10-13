"use client";

import { useFormAction } from "@/components/form";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Clock, Loader2, RotateCcw, Send, X } from "lucide-react";
import { castVoteAction, commentAction, openRoundAction } from "@/app/actions/words";

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="mt-3 font-medium text-no">
      {text}
    </p>
  ) : null;
}

export function InlineVote({ wordId }: { wordId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const vote = (v: "YES" | "NO" | "LATER") =>
    start(async () => {
      const r = await castVoteAction(wordId, v);
      setErr(r.ok ? null : r.error);
    });
  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn text-white" style={{ background: "var(--yes)" }} disabled={pending} onClick={() => vote("YES")}>
          <Check size={18} strokeWidth={3} aria-hidden /> Ja
        </button>
        <button type="button" className="btn" style={{ background: "var(--later)", color: "var(--later-ink)" }} disabled={pending} onClick={() => vote("LATER")}>
          <Clock size={18} strokeWidth={2.6} aria-hidden /> Später
        </button>
        <button type="button" className="btn text-white" style={{ background: "var(--no)" }} disabled={pending} onClick={() => vote("NO")}>
          <X size={18} strokeWidth={3} aria-hidden /> Nein
        </button>
        {pending && <Loader2 className="animate-spin self-center" size={20} aria-label="Speichert" />}
      </div>
      <ErrorLine text={err} />
    </>
  );
}

export function RoundButton({ wordId, kind, label, confirm: question }: { wordId: string; kind: "REVOTE" | "REVIEW"; label: string; confirm?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (question && !window.confirm(question)) return;
            const r = await openRoundAction(wordId, kind);
            setErr(r.ok ? null : r.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <RotateCcw size={18} aria-hidden />} {label}
      </button>
      <ErrorLine text={err} />
    </>
  );
}

export function CommentForm({ wordId }: { wordId: string }) {
  const [state, action, pending] = useFormAction(commentAction.bind(null, wordId));
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} onSubmit={action} className="mt-5">
      <label htmlFor={`c-${wordId}`} className="sr-only">
        Kommentar
      </label>
      <div className="flex items-end gap-2">
        <textarea id={`c-${wordId}`} name="body" required maxLength={2000} rows={2} placeholder="Kommentar" className="field min-h-[3.25rem] resize-y" />
        <button className="btn btn-primary size-12 shrink-0 px-0" disabled={pending} aria-label="Kommentar senden">
          {pending ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Send size={18} aria-hidden />}
        </button>
      </div>
      {state && !state.ok && <ErrorLine text={state.error} />}
    </form>
  );
}
