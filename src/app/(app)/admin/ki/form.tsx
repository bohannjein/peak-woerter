"use client";

import { useRef, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { aiSettingsAction, listModelsAction } from "@/app/actions/admin";
import { FormError, FormOk, useFormAction } from "@/components/form";

type Kind = "none" | "openai-compatible" | "anthropic";

// Base addresses of common providers. All except Anthropic speak the OpenAI API.
const PRESETS: { id: string; label: string; kind: Kind; url: string; hint?: string }[] = [
  { id: "none", label: "Keine KI", kind: "none", url: "" },
  { id: "openai", label: "OpenAI (ChatGPT)", kind: "openai-compatible", url: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic (Claude)", kind: "anthropic", url: "https://api.anthropic.com" },
  { id: "gemini", label: "Google Gemini", kind: "openai-compatible", url: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { id: "mistral", label: "Mistral", kind: "openai-compatible", url: "https://api.mistral.ai/v1" },
  { id: "openrouter", label: "OpenRouter (viele Modelle)", kind: "openai-compatible", url: "https://openrouter.ai/api/v1" },
  { id: "groq", label: "Groq", kind: "openai-compatible", url: "https://api.groq.com/openai/v1" },
  { id: "deepseek", label: "DeepSeek", kind: "openai-compatible", url: "https://api.deepseek.com/v1" },
  { id: "xai", label: "xAI (Grok)", kind: "openai-compatible", url: "https://api.x.ai/v1" },
  { id: "together", label: "Together AI", kind: "openai-compatible", url: "https://api.together.xyz/v1" },
  {
    id: "ollama",
    label: "Ollama (lokal)",
    kind: "openai-compatible",
    url: "http://host.docker.internal:11434/v1",
    hint: "Läuft Ollama auf demselben Server: Adresse so lassen und Ollama mit OLLAMA_HOST=0.0.0.0 starten. Anderer Rechner: dessen IP eintragen, z. B. http://192.168.1.20:11434/v1. Kein Schlüssel nötig.",
  },
  {
    id: "lmstudio",
    label: "LM Studio (lokal)",
    kind: "openai-compatible",
    url: "http://host.docker.internal:1234/v1",
    hint: "In LM Studio den Server starten und „Im Netzwerk bereitstellen“ aktivieren. Läuft es auf einem anderen Rechner: dessen IP eintragen. Kein Schlüssel nötig.",
  },
  { id: "custom", label: "Eigener Server (OpenAI-kompatibel)", kind: "openai-compatible", url: "", hint: "z. B. vLLM, LocalAI, llama.cpp, LiteLLM. Adresse endet meist auf /v1." },
];

const presetFor = (kind: string, url: string) =>
  kind === "none" ? "none" : (PRESETS.find((p) => p.kind === kind && p.url === url)?.id ?? (kind === "anthropic" ? "anthropic" : "custom"));

export function AiForm({ settings, hasKey }: { settings: { aiProvider: string; aiBaseUrl: string; aiModel: string }; hasKey: boolean }) {
  const [state, action, pending] = useFormAction(aiSettingsAction);
  const form = useRef<HTMLFormElement>(null);
  const [presetId, setPresetId] = useState(presetFor(settings.aiProvider, settings.aiBaseUrl));
  const [url, setUrl] = useState(settings.aiBaseUrl);
  const [models, setModels] = useState<string[] | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const preset = PRESETS.find((p) => p.id === presetId)!;
  const stored = preset.kind === settings.aiProvider && url === settings.aiBaseUrl;

  const loadModels = () =>
    startLoading(async () => {
      setModelError(null);
      const r = await listModelsAction(new FormData(form.current!));
      if (r.ok) {
        setModels(r.data);
        if (!r.data.length) setModelError("Der Anbieter hat keine Modelle gemeldet. Modellnamen von Hand eintragen.");
      } else setModelError(r.error);
    });

  return (
    <form ref={form} onSubmit={action} className="mt-6 space-y-5">
      <input type="hidden" name="aiProvider" value={preset.kind} />
      <div>
        <label htmlFor="preset" className="label">
          Anbieter
        </label>
        <select
          id="preset"
          value={presetId}
          onChange={(e) => {
            const p = PRESETS.find((x) => x.id === e.target.value)!;
            setPresetId(p.id);
            setUrl(p.url);
            setModels(null);
            setModelError(null);
          }}
          className="field"
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {preset.hint && <p className="mt-1.5 text-sm text-ink-2">{preset.hint}</p>}
      </div>
      {preset.kind !== "none" && (
        <>
          <div>
            <label htmlFor="url" className="label">
              Adresse
            </label>
            <input id="url" name="aiBaseUrl" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/v1" className="field" inputMode="url" />
          </div>
          <div>
            <label htmlFor="key" className="label">
              API-Schlüssel
            </label>
            <input
              id="key"
              name="aiApiKey"
              type="password"
              autoComplete="off"
              placeholder={hasKey && stored ? "gespeichert – leer lassen zum Behalten" : "bei lokalen Modellen meist leer"}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="model" className="label">
              Modell
            </label>
            <div className="flex gap-2">
              <input id="model" name="aiModel" list="ai-models" defaultValue={settings.aiModel} placeholder="erst Modelle laden" className="field" autoComplete="off" />
              <button type="button" onClick={loadModels} disabled={loading} className="btn btn-quiet shrink-0">
                <RefreshCw size={17} aria-hidden className={loading ? "animate-spin" : undefined} /> Modelle laden
              </button>
            </div>
            <datalist id="ai-models">
              {models?.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {models && models.length > 0 && <p className="mt-1.5 text-sm text-ink-2">{models.length} Modelle gefunden. Ins Feld klicken zum Auswählen.</p>}
            {modelError && (
              <p role="alert" className="mt-1.5 text-sm font-medium text-no">
                {modelError}
              </p>
            )}
          </div>
        </>
      )}
      <FormError state={state} />
      <FormOk state={state} text="Gespeichert." />
      <button className="btn btn-primary" disabled={pending}>
        Speichern
      </button>
    </form>
  );
}
