"use client";

import { useState } from "react";
import { guestLinkAction, guestSettingsAction } from "@/app/actions/admin";
import { FormError, FormOk, Toggle, useFormAction } from "@/components/form";
import { CopyLink } from "../benutzer/client";

export function GuestModeForm({ enabled, open, until }: { enabled: boolean; open: "aus" | "bis" | "immer"; until: string }) {
  const [state, action, pending] = useFormAction(guestSettingsAction);
  const [mode, setMode] = useState(open);
  return (
    <form onSubmit={action} className="mt-5 space-y-4">
      <Toggle name="guestEnabled" label="Gastmodus aktiv" hint="Hauptschalter. Aus = alle Gastlinks und offenen Zugänge funktionieren nicht." defaultChecked={enabled} />
      <fieldset>
        <legend className="label">Ohne Link für alle offen</legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["aus", "Nein"],
              ["bis", "Bis zu einem Datum"],
              ["immer", "Dauerhaft"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="chip cursor-pointer has-[:checked]:bg-ink has-[:checked]:text-table">
              <input type="radio" name="open" value={k} checked={mode === k} onChange={() => setMode(k)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {mode === "bis" && (
        <div>
          <label htmlFor="until" className="label">
            Offen bis
          </label>
          <input id="until" name="until" type="datetime-local" defaultValue={until} required className="field w-auto" />
        </div>
      )}
      <FormError state={state} />
      <FormOk state={state} text="Gespeichert." />
      <button className="btn btn-primary" disabled={pending}>
        Speichern
      </button>
    </form>
  );
}

export function GuestLinkForm() {
  const [state, action, pending] = useFormAction(guestLinkAction);
  const [kind, setKind] = useState<"einmalig" | "zeitlich">("einmalig");
  const link = state?.ok ? (state.data as { link: string }).link : null;
  return (
    <form onSubmit={action} className="mt-6 space-y-4 rounded-2xl border-[1.5px] border-line p-5">
      <p className="font-bold">Neuer Gastlink</p>
      <div>
        <label htmlFor="gl-label" className="label">
          Für wen? <span className="font-normal text-ink-3">(optional, nur für dich)</span>
        </label>
        <input id="gl-label" name="label" maxLength={60} className="field" />
      </div>
      <fieldset>
        <legend className="label">Art</legend>
        <div className="flex flex-wrap gap-2">
          <label className="chip cursor-pointer has-[:checked]:bg-ink has-[:checked]:text-table">
            <input type="radio" name="kind" value="einmalig" checked={kind === "einmalig"} onChange={() => setKind("einmalig")} className="sr-only" />
            Einmalig
          </label>
          <label className="chip cursor-pointer has-[:checked]:bg-ink has-[:checked]:text-table">
            <input type="radio" name="kind" value="zeitlich" checked={kind === "zeitlich"} onChange={() => setKind("zeitlich")} className="sr-only" />
            Mehrfach, zeitlich begrenzt
          </label>
        </div>
        <p className="hint">{kind === "einmalig" ? "Funktioniert für genau einen Browser." : "Jeder, der den Link öffnet, bekommt einen eigenen Gastzugang."}</p>
      </fieldset>
      <div>
        <label htmlFor="gl-h" className="label">
          Gültig für (Stunden)
        </label>
        <input id="gl-h" name="hours" type="number" min={1} max={2160} defaultValue={kind === "einmalig" ? 168 : 24} key={kind} className="field w-32" />
      </div>
      <FormError state={state} />
      <button className="btn btn-primary" disabled={pending}>
        Link erstellen
      </button>
      {link && <CopyLink link={link} note="Nur einmal sichtbar. Persönlich weitergeben." />}
    </form>
  );
}
