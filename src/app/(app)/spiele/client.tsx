"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic } from "lucide-react";
import { submitSentenceAction, voteSentenceAction } from "@/app/actions/games";
import { FormError, useFormAction } from "@/components/form";

export function SentenceForm({ voice }: { voice: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useFormAction(submitSentenceAction);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-5">
      <form onSubmit={action} className="space-y-3">
        <label htmlFor="satz" className="label">
          Dein Satz
        </label>
        <textarea id="satz" name="text" required minLength={3} maxLength={300} rows={3} className="field resize-y" placeholder="Klingt glaubwürdig, auch wenn’s Quatsch ist." />
        <FormError state={state} />
        <button className="btn btn-primary" disabled={pending}>
          Abgeben
        </button>
      </form>
      {voice && (
        // Native capture: phones open their recorder directly.
        <label className="btn btn-quiet mt-3 cursor-pointer">
          {busy ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Mic size={18} aria-hidden />} Stattdessen aufnehmen
          <input
            type="file"
            accept="audio/*"
            capture="user"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              const r = await fetch("/api/spiel/neu", { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
              setBusy(false);
              setErr(r.ok ? null : ((await r.json().catch(() => null))?.error ?? "Hochladen fehlgeschlagen."));
              router.refresh();
            }}
          />
        </label>
      )}
      {err && (
        <p role="alert" className="mt-2 font-semibold text-no">
          {err}
        </p>
      )}
    </div>
  );
}

export function VoteButton({ entryId }: { entryId: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await voteSentenceAction(entryId);
            setErr(r.ok ? null : r.error);
          })
        }
      >
        Dieser!
      </button>
      {err && (
        <span role="alert" className="mt-1 text-sm font-semibold text-no">
          {err}
        </span>
      )}
    </span>
  );
}
