"use client";

import { Upload } from "lucide-react";
import { importAction } from "@/app/actions/admin";
import { FormError, useFormAction } from "@/components/form";

export function ImportForm() {
  const [state, action, pending] = useFormAction(importAction);
  const r = state?.ok ? state.data : null;
  return (
    <form onSubmit={action} className="mt-5 space-y-5">
      <input type="file" name="datei" accept="application/json,.json" required className="field" />
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="einstellungen" defaultChecked className="size-5" /> Admin-Einstellungen
        </label>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" name="woerter" defaultChecked className="size-5" /> Wörter
        </label>
      </div>
      <FormError state={state} />
      {r && (
        <p role="status" className="rounded-xl border-[1.5px] border-yes/60 bg-yes/10 px-4 py-3 font-medium">
          Importiert: {r.words} Wörter, {r.categories} neue Kategorien, {r.settings} Einstellungen. {r.skipped > 0 && `${r.skipped} Wörter gab es schon.`}
          {r.notes.map((n) => (
            <span key={n} className="mt-1 block">
              {n}
            </span>
          ))}
        </p>
      )}
      <button className="btn btn-primary" disabled={pending}>
        <Upload size={18} aria-hidden /> {pending ? "Importiere …" : "Importieren"}
      </button>
    </form>
  );
}
