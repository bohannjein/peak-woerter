"use client";

import { useState, useTransition } from "react";
import { Flag, Heart, Loader2 } from "lucide-react";
import { setFavoriteAction } from "@/app/actions/member";
import { openRoundAction } from "@/app/actions/words";

export function FavoriteButton({ wordId, active }: { wordId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-quiet btn-sm"
      aria-pressed={active}
      disabled={pending}
      onClick={() => start(async () => void (await setFavoriteAction(active ? null : wordId)))}
    >
      <Heart size={17} aria-hidden fill={active ? "currentColor" : "none"} /> {active ? "Mein Lieblingswort" : "Als Lieblingswort"}
    </button>
  );
}

/** Challenge an accepted word: it goes back to the vote and leaves only with 100 % Nein. */
export function ChallengeButton({ wordId, term }: { wordId: string; term: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        className="btn btn-quiet btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const reason = window.prompt(`Warum soll „${term}“ neu abgestimmt werden? Das Wort fliegt nur raus, wenn alle Kuratoren Nein sagen.`);
            if (reason === null) return;
            const r = await openRoundAction(wordId, "REVIEW", reason.trim() || undefined);
            setMsg(r.ok ? { ok: true, t: "Angefochten. Die Kuratoren stimmen neu ab." } : { ok: false, t: r.error });
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" size={17} aria-hidden /> : <Flag size={17} aria-hidden />} Anfechten
      </button>
      {msg && (
        <span role={msg.ok ? "status" : "alert"} className={`mt-1 text-sm font-semibold ${msg.ok ? "text-yes" : "text-no"}`}>
          {msg.t}
        </span>
      )}
    </span>
  );
}
