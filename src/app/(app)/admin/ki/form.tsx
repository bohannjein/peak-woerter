"use client";

import { aiSettingsAction } from "@/app/actions/admin";
import { FormError, FormOk, useFormAction } from "@/components/form";

export function AiForm({ settings }: { settings: { aiProvider: string; aiBaseUrl: string; aiModel: string } }) {
  const [state, action, pending] = useFormAction(aiSettingsAction);
  return (
    <form onSubmit={action} className="mt-6 space-y-5">
      <div>
        <label htmlFor="prov" className="label">
          Anbieter
        </label>
        <select id="prov" name="aiProvider" defaultValue={settings.aiProvider} className="field">
          <option value="none">Keine KI</option>
          <option value="openai-compatible">OpenAI-kompatibel</option>
        </select>
      </div>
      <div>
        <label htmlFor="url" className="label">
          Basis-Adresse
        </label>
        <input id="url" name="aiBaseUrl" defaultValue={settings.aiBaseUrl} placeholder="https://api.example.com/v1" className="field" inputMode="url" />
      </div>
      <div>
        <label htmlFor="model" className="label">
          Modell
        </label>
        <input id="model" name="aiModel" defaultValue={settings.aiModel} className="field" />
      </div>
      <FormError state={state} />
      <FormOk state={state} text="Gespeichert." />
      <button className="btn btn-primary" disabled={pending}>
        Speichern
      </button>
    </form>
  );
}
