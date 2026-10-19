"use client";

import { saveElectionAction } from "@/app/actions/elections";
import { FormError, FormOk, useFormAction } from "@/components/form";

type Values = { nominateFrom: string; shortlistFrom: string; finalFrom: string; endsAt: string; nominations: number; shortlistVotes: number; finalists: number };

export function ElectionForm({ kind, year, values }: { kind: "JURY" | "COMMUNITY"; year: number; values: Values }) {
  const [state, action, pending] = useFormAction(saveElectionAction);
  const id = (k: string) => `${kind}-${k}`;
  const date = (name: keyof Values, label: string) => (
    <div>
      <label htmlFor={id(name)} className="label">
        {label}
      </label>
      <input id={id(name)} name={name} type="datetime-local" required defaultValue={String(values[name])} className="field" />
    </div>
  );
  const num = (name: keyof Values, label: string, min: number) => (
    <div>
      <label htmlFor={id(name)} className="label">
        {label}
      </label>
      <input id={id(name)} name={name} type="number" min={min} max={20} required defaultValue={values[name]} className="field" />
    </div>
  );
  return (
    <form onSubmit={action} className="mt-5 space-y-4">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="year" value={year} />
      <div className="grid gap-4 sm:grid-cols-2">
        {date("nominateFrom", "Runde 1 (Nominieren) ab")}
        {date("shortlistFrom", "Runde 2 (Vorauswahl) ab")}
        {date("finalFrom", "Runde 3 (Finale) ab")}
        {date("endsAt", "Ergebnis am")}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {num("nominations", "Nominierungen pro Person", 1)}
        {num("shortlistVotes", "Up-/Downvotes in Runde 2", 1)}
        {num("finalists", "Wörter im Finale", 2)}
      </div>
      <FormError state={state} />
      <FormOk state={state} text="Gespeichert." />
      <button className="btn btn-primary" disabled={pending}>
        Speichern
      </button>
    </form>
  );
}
