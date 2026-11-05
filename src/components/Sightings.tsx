"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { addSightingAction, deleteSightingAction } from "@/app/actions/sightings";
import { FormError, useFormAction } from "./form";

export type SightingItem = { id: string; saidOn: string; occasion: string; saidBy: string | null; quote: string | null; user: { id: string; name: string } };

const DATE = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function AddForm({ wordId, today, onDone }: { wordId: string; today: string; onDone: () => void }) {
  const [state, onSubmit, pending] = useFormAction(async (prev: unknown, fd: FormData) => {
    const r = await addSightingAction(wordId, prev, fd);
    if (r.ok) onDone();
    return r;
  });
  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-lg space-y-4 rounded-2xl border-[1.5px] border-line p-5">
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor="b-date" className="label">
            Wann
          </label>
          <input id="b-date" name="saidOn" type="date" required max={today} defaultValue={today} className="field" />
        </div>
        <div>
          <label htmlFor="b-occ" className="label">
            Wo oder wobei
          </label>
          <input id="b-occ" name="occasion" required maxLength={120} placeholder="z. B. Grillabend bei Tom" className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="b-by" className="label">
          Wer hat es gesagt <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <input id="b-by" name="saidBy" maxLength={60} className="field" />
      </div>
      <div>
        <label htmlFor="b-quote" className="label">
          Der Satz dazu <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <textarea id="b-quote" name="quote" rows={2} maxLength={300} className="field" />
      </div>
      <FormError state={state} />
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden />} Beleg speichern
        </button>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onDone}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        aria-label="Beleg löschen"
        className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-table-2 hover:text-ink"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!window.confirm("Diesen Beleg löschen?")) return;
            const r = await deleteSightingAction(id);
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Trash2 size={15} aria-hidden />}
      </button>
      {error && (
        <span role="alert" className="text-sm text-no">
          {error}
        </span>
      )}
    </>
  );
}

/** Timeline of Belege on the word page, newest first, with a form to add one. */
export function Sightings({ wordId, items, me, isAdmin, today }: { wordId: string; items: SightingItem[]; me: string; isAdmin: boolean; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section id="belege" aria-labelledby="belege-h" className="mt-12 max-w-[40rem] scroll-mt-24 border-t border-line pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="belege-h" className="section-title">
          Belege
        </h2>
        {!open && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setOpen(true)}>
            <Plus size={17} aria-hidden /> Beleg eintragen
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink-3">Wann und wo das Wort wirklich gefallen ist. Nur Mitglieder sehen das.</p>
      {open && <AddForm wordId={wordId} today={today} onDone={() => setOpen(false)} />}
      {items.length === 0 ? (
        !open && <p className="mt-5 text-ink-3">Noch kein Beleg. Hast du es zuletzt irgendwo gehört?</p>
      ) : (
        <ol className="mt-5 border-l-2 border-line">
          {items.map((s) => (
            <li key={s.id} className="relative pb-6 pl-6 last:pb-0">
              <span className="absolute top-2 -left-[7px] size-3 rounded-full border-2 border-table bg-ink-2" aria-hidden />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="tabular text-sm text-ink-3">
                    <time dateTime={s.saidOn}>{DATE.format(new Date(`${s.saidOn}T00:00:00Z`))}</time>
                  </p>
                  <p className="font-semibold">{s.occasion}</p>
                  {s.quote && <p className="lex-italic mt-1 text-[1.15rem] leading-snug">„{s.quote}“</p>}
                  <p className="mt-1 text-sm text-ink-2">
                    {s.saidBy && <>gesagt von {s.saidBy} · </>}
                    eingetragen von{" "}
                    <Link href={`/profil/${s.user.id}`} className="underline decoration-line hover:decoration-ink">
                      {s.user.id === me ? "dir" : s.user.name}
                    </Link>
                  </p>
                </div>
                {(s.user.id === me || isAdmin) && <DeleteButton id={s.id} />}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
