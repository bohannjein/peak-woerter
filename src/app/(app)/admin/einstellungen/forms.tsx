"use client";

import { featureSettingsAction, votingSettingsAction } from "@/app/actions/admin";
import { FormError, FormOk, Toggle, useFormAction } from "@/components/form";
import type { Settings } from "@/lib/settings";

export function VotingForm({ s }: { s: Settings }) {
  const [state, action, pending] = useFormAction(votingSettingsAction);
  return (
    <form onSubmit={action} className="mt-5 space-y-5">
      <div>
        <label htmlFor="vc" className="label">
          Anzahl Voter (Kuratorenplätze)
        </label>
        <input id="vc" name="voterCount" type="number" min={2} max={20} defaultValue={s.voterCount} className="field w-32" />
        <p className="hint">Eine Runde ist entschieden, sobald alle Voter abgestimmt haben (oder die Frist abläuft). Mit 2 Votern gilt immer: Ja+Ja = Sammlung, Nein+Nein = Negativliste, sonst Später.</p>
      </div>
      <fieldset>
        <legend className="label">Regel ab 3 Votern</legend>
        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-2xl border-[1.5px] border-line p-4 has-[:checked]:border-ink">
            <input type="radio" name="voteRule" value="majority" defaultChecked={s.voteRule === "majority"} className="mt-1 size-5 accent-[var(--ink)]" />
            <span>
              <span className="block font-semibold">Mehrheitsprinzip</span>
              <span className="text-sm text-ink-2">Mehr als 50 % Ja = angenommen, mehr als 50 % Nein = abgelehnt, sonst Später.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border-[1.5px] border-line p-4 has-[:checked]:border-ink">
            <input type="radio" name="voteRule" value="unanimous" defaultChecked={s.voteRule === "unanimous"} className="mt-1 size-5 accent-[var(--ink)]" />
            <span>
              <span className="block font-semibold">Absolutprinzip</span>
              <span className="text-sm text-ink-2">Nur 100 % Ja = angenommen. Sonst abgelehnt; wer „Später“ wählt, schiebt das Wort auf die Später-Liste.</span>
            </span>
          </label>
        </div>
      </fieldset>
      <div>
        <label htmlFor="dl" className="label">
          Frist für Abstimmungen in Stunden
        </label>
        <input id="dl" name="voteDeadlineHours" type="number" min={0} max={8760} defaultValue={s.voteDeadlineHours} className="field w-32" />
        <p className="hint">0 = unbegrenzt. Mit Frist wird nach Ablauf mit den abgegebenen Stimmen entschieden; fehlende zählen weder als Ja noch als Nein. Gilt für neue Runden.</p>
      </div>
      <p className="hint">Anfechtungen: Ein angefochtenes Wort fliegt nur raus, wenn 100 % mit Nein stimmen.</p>
      <FormError state={state} />
      <FormOk state={state} text="Gespeichert." />
      <button className="btn btn-primary" disabled={pending}>
        Speichern
      </button>
    </form>
  );
}

export function FeatureForm({ s }: { s: Settings }) {
  const [state, action, pending] = useFormAction(featureSettingsAction);
  return (
    <form onSubmit={action} className="mt-5 space-y-4">
      <Toggle name="autoTag" label="Automatisch taggen" hint="Neue Wörter bekommen Kategorien anhand der Stichwörter der Kategorien." defaultChecked={s.autoTag} />
      <Toggle name="gameVoice" label="Minispiel: Sprachaufnahmen" hint="Sätze dürfen auch per Mikrofon aufgenommen werden." defaultChecked={s.gameVoice} />
      <FormError state={state} />
      <FormOk state={state} text="Gespeichert." />
      <button className="btn btn-primary" disabled={pending}>
        Speichern
      </button>
    </form>
  );
}
