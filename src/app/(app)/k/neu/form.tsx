"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { submitWordAction } from "@/app/actions/words";
import { checkDuplicateAction } from "@/app/actions/lookup";
import { FormError, useFormAction } from "@/components/form";
import { DraftBanner, LeaveGuard, useDraft } from "@/components/LeaveGuard";

export function AddWordForm() {
  const [state, action, pending] = useFormAction(submitWordAction);
  const [dup, setDup] = useState<{ message: string; href?: string } | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [term, setTerm] = useState("");
  const [note, setNote] = useState("");
  const dirty = !!(term.trim() || note.trim());
  const draft = useDraft("peake-draft:neu", { term, note }, dirty);
  const formRef = useRef<HTMLFormElement>(null);
  const termRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setTerm("");
      setNote("");
      draft.clear();
      setDup(null);
      setShowNote(false);
      termRef.current?.focus();
    }
  }, [state]);

  function onTerm(value: string) {
    clearTimeout(timer.current);
    if (!value.trim()) return setDup(null);
    timer.current = setTimeout(async () => setDup(await checkDuplicateAction(value)), 350);
  }

  const added = state?.ok ? (state.data as { term: string; id: string }) : null;

  return (
    <form ref={formRef} onSubmit={action} className="mt-8 space-y-5">
      <LeaveGuard dirty={dirty} onKeep={draft.write} onDiscard={draft.clear} />
      {draft.found && !dirty && (
        <DraftBanner
          at={draft.found.at}
          onRestore={() => {
            setTerm(draft.found!.value.term);
            setNote(draft.found!.value.note);
            setShowNote(!!draft.found!.value.note);
            onTerm(draft.found!.value.term);
            draft.dismiss();
          }}
          onDiscard={draft.clear}
        />
      )}
      <div>
        <label htmlFor="term" className="sr-only">
          Wort
        </label>
        <input
          ref={termRef}
          id="term"
          name="term"
          required
          maxLength={120}
          autoFocus
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="send"
          placeholder="Wort eingeben"
          aria-invalid={dup ? true : undefined}
          aria-describedby="dup"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            onTerm(e.target.value);
          }}
          className="field display h-20 text-[2.25rem] placeholder:font-normal placeholder:text-[1.4rem]"
        />
        <p id="dup" aria-live="polite" className="mt-2 min-h-6 text-[0.95rem] font-medium text-no">
          {dup?.message}
          {dup?.href && (
            <>
              {" "}
              <Link href={dup.href} className="text-ink underline">
                Ansehen
              </Link>
            </>
          )}
        </p>
      </div>

      {showNote ? (
        <div>
          <label htmlFor="note" className="label">
            Notiz
          </label>
          <textarea id="note" name="note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="field" />
        </div>
      ) : (
        <button type="button" onClick={() => setShowNote(true)} className="text-[0.95rem] font-semibold text-ink-2 underline">
          + Notiz
        </button>
      )}

      <label className="flex items-center gap-3 text-[0.95rem]">
        <input type="checkbox" name="voteYes" defaultChecked className="size-5 accent-[var(--yes)]" />
        Direkt mit Ja stimmen
      </label>

      <FormError state={state} />
      {added && (
        <p role="status" className="flex items-center gap-2 rounded-xl border-[1.5px] border-yes/60 bg-yes/10 px-4 py-3 font-semibold">
          <Check size={18} aria-hidden /> „{added.term}“ hinzugefügt.
        </p>
      )}

      <button className="btn btn-primary h-14 w-full text-lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" size={20} aria-hidden />} Hinzufügen
      </button>
    </form>
  );
}
