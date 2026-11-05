"use client";

import { useState, useTransition } from "react";
import { Check, Share2 } from "lucide-react";
import { puzzleMoveAction } from "@/app/actions/games";
import type { PlayResult } from "@/lib/puzzles/play";
import type { PuzzleKey } from "@/lib/puzzles/registry";

/** Sends a move; the server answers with the new view. */
export function useMove<K extends PuzzleKey>(game: K, initial: PlayResult<K>) {
  const [result, setResult] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = (input: unknown) =>
    new Promise<PlayResult<K> | null>((resolve) =>
      start(async () => {
        const r = await puzzleMoveAction(game, input);
        if (r.ok) {
          setResult(r.data as PlayResult<K>);
          setError(null);
          resolve(r.data as PlayResult<K>);
        } else {
          setError(r.error);
          resolve(null);
        }
      }),
    );
  return { result, error, setError, pending, send };
}

export function MoveError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-3 font-semibold text-no">
      {error}
    </p>
  );
}

export const dayLabel = (day: string) => new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

/** Copies a spoiler-free result; uses the share sheet where there is one. */
export function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet btn-sm"
      onClick={async () => {
        try {
          if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ text });
          else {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        } catch {
          // Share sheet closed or clipboard blocked: nothing to do.
        }
      }}
    >
      {copied ? <Check size={16} aria-hidden /> : <Share2 size={16} aria-hidden />} {copied ? "Kopiert" : "Ergebnis teilen"}
    </button>
  );
}
