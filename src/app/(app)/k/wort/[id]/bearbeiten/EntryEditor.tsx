"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Plus, Sparkles, Trash2, X } from "lucide-react";
import { saveEntryAction } from "@/app/actions/words";
import { requestAiDraftAction, setAiDraftStatusAction } from "@/app/actions/ai";
import { POS_LABEL, bandClass } from "@/lib/categories";
import type { Suggestion } from "@/lib/ai";
import { DraftBanner, LeaveGuard, useDraft } from "@/components/LeaveGuard";

type Pron = { ipa: string; label: string; verified: boolean; position?: number; hasAudio?: boolean };
type Form = {
  term: string;
  partOfSpeech: keyof typeof POS_LABEL | null;
  grammar: string;
  usage: string;
  origin: string;
  variants: string[];
  definitions: { text: string; detail: string }[];
  pronunciations: Pron[];
  examples: string[];
  categoryIds: string[];
  /** AI drafts something was taken from; marked as applied only once the entry is saved. */
  aiDraftIds?: string[];
};

// Characters German IPA needs that phone keyboards lack.
const IPA_KEYS = ["ˈ", "ˌ", "ː", "ə", "ɐ", "ɪ", "ʊ", "ʏ", "ɛ", "ɔ", "œ", "ø", "ŋ", "ç", "x", "ʃ", "ʒ", "ʁ", "ʔ", "t͡s", "p͡f", "t͡ʃ", "a͡ɪ", "a͡ʊ", "ɔ͡ʏ", "̯", "̃"];

export function EntryEditor({
  wordId,
  status,
  initial,
  categories,
  aiAvailable,
  draft: initialDraft,
}: {
  wordId: string;
  status: string;
  initial: Form;
  categories: { id: string; name: string; color: string }[];
  aiAvailable: boolean;
  draft: { id: string; content: Suggestion } | null;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Form>(() => ({
    ...initial,
    definitions: initial.definitions.length ? initial.definitions : [{ text: "", detail: "" }],
    examples: initial.examples.length ? initial.examples : [""],
  }));
  const [f, setF] = useState<Form>(saved);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const local = useDraft(`wort:${wordId}`, f, dirty);
  const [meaningChanged, setMeaningChanged] = useState(false);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [saving, startSave] = useTransition();
  const [aiBusy, startAi] = useTransition();
  const [draft, setDraft] = useState(initialDraft);
  const [aiHint, setAiHint] = useState("");
  const ipaRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [ipaFocus, setIpaFocus] = useState(0);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const termChanged = f.term.trim().toLowerCase() !== initial.term.trim().toLowerCase();

  function insertIpa(ch: string) {
    const el = ipaRefs.current[ipaFocus];
    const list = [...f.pronunciations];
    if (!list[ipaFocus]) return;
    const pos = el?.selectionStart ?? list[ipaFocus].ipa.length;
    const v = list[ipaFocus].ipa;
    list[ipaFocus] = { ...list[ipaFocus], ipa: v.slice(0, pos) + ch + v.slice(el?.selectionEnd ?? pos) };
    set("pronunciations", list);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + ch.length, pos + ch.length);
    });
  }

  function save() {
    startSave(async () => {
      if (status === "ACCEPTED" && (termChanged || meaningChanged) && !confirm("Wesentliche Änderung – Neubewertung starten?")) return;
      const r = await saveEntryAction(wordId, {
        term: f.term,
        partOfSpeech: f.partOfSpeech,
        grammar: f.grammar || null,
        usage: f.usage || null,
        origin: f.origin || null,
        variants: f.variants.filter((x) => x.trim()),
        definitions: f.definitions.map((d) => ({ text: d.text, detail: d.detail || null })),
        pronunciations: f.pronunciations.map((p) => ({ ipa: p.ipa, label: p.label || null, verified: p.verified })),
        examples: f.examples,
        categoryIds: f.categoryIds,
        meaningChanged,
      });
      if (!r.ok) return setMsg({ t: r.error, ok: false });
      // Only now the word counts as "bearbeitet mit KI" (shown on the word page).
      for (const id of f.aiDraftIds ?? []) void setAiDraftStatusAction(id, "APPLIED");
      setMsg({ t: r.data.essential && status === "ACCEPTED" ? "Gespeichert. Neubewertung gestartet." : "Gespeichert.", ok: true });
      setMeaningChanged(false);
      setSaved({ ...f, aiDraftIds: [] });
      setF((cur) => ({ ...cur, aiDraftIds: [] }));
      local.clear();
      router.refresh();
    });
  }

  function applyDraft(s: Suggestion, field: string, draftId: string) {
    setF((cur) => ({ ...cur, aiDraftIds: [...new Set([...(cur.aiDraftIds ?? []), draftId])] }));
    if (field === "shortDefinition" && s.shortDefinition) {
      const defs = [...f.definitions];
      if (!defs[0]?.text) defs[0] = { text: s.shortDefinition, detail: s.meaning ?? "" };
      else defs.push({ text: s.shortDefinition, detail: s.meaning ?? "" });
      set("definitions", defs);
    }
    if (field === "partOfSpeech" && s.partOfSpeech) set("partOfSpeech", s.partOfSpeech);
    // AI IPA is never marked as confirmed.
    if (field === "ipa" && s.ipa) set("pronunciations", [...f.pronunciations, { ipa: s.ipa, label: "", verified: false }]);
    if (field === "example" && s.example) set("examples", [...f.examples.filter(Boolean), s.example]);
    if (field === "origin" && s.origin) set("origin", f.origin ? `${f.origin}\n${s.origin}` : s.origin);
    if (field === "variants") set("variants", [...new Set([...f.variants, ...s.variants])]);
    if (field === "categories") {
      const ids = categories.filter((c) => s.categories.some((n) => n.toLowerCase() === c.name.toLowerCase())).map((c) => c.id);
      set("categoryIds", [...new Set([...f.categoryIds, ...ids])]);
    }
  }

  return (
    <div className="mt-8 space-y-10 pb-28">
      <LeaveGuard dirty={dirty} onKeep={local.write} onDiscard={local.clear} />
      {local.found && !dirty && (
        <DraftBanner
          at={local.found.at}
          onRestore={() => {
            setF(local.found!.value);
            local.dismiss();
          }}
          onDiscard={local.clear}
        />
      )}
      {aiAvailable && (
        <section className="rounded-[20px] border-[1.5px] border-line p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-bold">KI-Entwurf</p>
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              disabled={aiBusy}
              onClick={() =>
                startAi(async () => {
                  const r = await requestAiDraftAction(wordId, aiHint);
                  if (!r.ok) return setMsg({ t: r.error, ok: false });
                  setDraft(r.data as { id: string; content: Suggestion });
                })
              }
            >
              {aiBusy ? <Loader2 className="animate-spin" size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />} {draft ? "Neuer Entwurf" : "Entwurf holen"}
            </button>
          </div>
          <div className="mt-4">
            <label htmlFor="ai-hint" className="label">
              Beschreibung für die KI <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <textarea id="ai-hint" rows={2} maxLength={500} value={aiHint} onChange={(e) => setAiHint(e.target.value)} className="field" placeholder="Was das Wort bei euch bedeutet" />
          </div>
          {draft ? (
            <AiDraftView
              s={draft.content}
              categories={categories}
              onApply={(field) => {
                applyDraft(draft.content, field, draft.id);
              }}
              onDiscard={() => {
                void setAiDraftStatusAction(draft.id, "DISCARDED");
                setDraft(null);
              }}
            />
         ) : null}
        </section>
      )}

      <section className="space-y-5">
        <div>
          <label htmlFor="term" className="label">
            Begriff
          </label>
          <input id="term" value={f.term} onChange={(e) => set("term", e.target.value)} className="field display h-16 text-[2rem]" maxLength={120} />
          {termChanged && status === "ACCEPTED" && <p className="hint font-semibold text-no">Startet eine Neubewertung.</p>}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="pos" className="label">
              Wortart
            </label>
            <select id="pos" value={f.partOfSpeech ?? ""} onChange={(e) => set("partOfSpeech", (e.target.value || null) as Form["partOfSpeech"])} className="field">
              <option value="">– keine Angabe –</option>
              {Object.entries(POS_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="grammar" className="label">
              Grammatik <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <input id="grammar" value={f.grammar} onChange={(e) => set("grammar", e.target.value)} className="field" placeholder="z. B. maskulin" maxLength={200} />
          </div>
        </div>
      </section>

      <section aria-labelledby="h-def">
        <h2 id="h-def" className="section-title">
          Bedeutungen
        </h2>
        <ol className="mt-4 space-y-4">
          {f.definitions.map((d, i) => (
            <li key={i} className="grid grid-cols-[1.75rem_1fr_auto] items-start gap-2">
              <span className="display tabular pt-3 text-2xl text-ink-3">{i + 1}</span>
              <div className="space-y-2">
                <label className="sr-only" htmlFor={`def-${i}`}>
                  Kurzdefinition {i + 1}
                </label>
                <textarea
                  id={`def-${i}`}
                  rows={2}
                  maxLength={600}
                  value={d.text}
                  placeholder="Kurzdefinition"
                  onChange={(e) => set("definitions", f.definitions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                  className="field"
                />
                <label className="sr-only" htmlFor={`det-${i}`}>
                  Ausführlicher {i + 1}
                </label>
                <textarea
                  id={`det-${i}`}
                  rows={1}
                  maxLength={2000}
                  value={d.detail}
                  placeholder="Ausführlicher (optional)"
                  onChange={(e) => set("definitions", f.definitions.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))}
                  className="field text-[0.95rem]"
                />
              </div>
              <RemoveBtn label={`Bedeutung ${i + 1} entfernen`} onClick={() => set("definitions", f.definitions.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ol>
        <AddBtn onClick={() => set("definitions", [...f.definitions, { text: "", detail: "" }])}>Weitere Bedeutung</AddBtn>
        <label className="mt-5 flex items-start gap-3 text-[0.95rem]">
          <input type="checkbox" checked={meaningChanged} onChange={(e) => setMeaningChanged(e.target.checked)} className="mt-0.5 size-5 accent-[var(--no)]" />
          <span>
            <strong>Bedeutung grundlegend geändert</strong>
            <span className="block text-ink-2">Startet eine Neubewertung.</span>
          </span>
        </label>
      </section>

      <section aria-labelledby="h-ipa">
        <h2 id="h-ipa" className="section-title">
          Aussprache
        </h2>
        <p className="mt-1 text-sm text-ink-2">IPA ohne Klammern. Nur bestätigte Lautschrift wird angezeigt.</p>
        <ul className="mt-4 space-y-3">
          {f.pronunciations.map((p, i) => (
            <li key={i} className="rounded-2xl border-[1.5px] border-line p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]">
                <label className="sr-only" htmlFor={`ipa-${i}`}>
                  Lautschrift {i + 1}
                </label>
                <input
                  id={`ipa-${i}`}
                  ref={(el) => {
                    ipaRefs.current[i] = el;
                  }}
                  value={p.ipa}
                  onFocus={() => setIpaFocus(i)}
                  onChange={(e) => set("pronunciations", f.pronunciations.map((x, j) => (j === i ? { ...x, ipa: e.target.value } : x)))}
                  className="field ipa-input font-lex text-[1.2rem]"
                  placeholder="ˈmʊmpɪt͡s"
                  lang="und-fonipa"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <label className="sr-only" htmlFor={`lab-${i}`}>
                  Bezeichnung
                </label>
                <input id={`lab-${i}`} value={p.label} onChange={(e) => set("pronunciations", f.pronunciations.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className="field" placeholder="Variante (optional)" maxLength={80} />
                <RemoveBtn label={`Aussprache ${i + 1} entfernen`} onClick={() => set("pronunciations", f.pronunciations.filter((_, j) => j !== i))} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[0.95rem]">
                  <input type="checkbox" checked={p.verified} onChange={(e) => set("pronunciations", f.pronunciations.map((x, j) => (j === i ? { ...x, verified: e.target.checked } : x)))} className="size-5 accent-[var(--yes)]" />
                  Bestätigt
                </label>
                {p.position && p.ipa === initial.pronunciations.find((o) => o.position === p.position)?.ipa && <AudioUpload wordId={wordId} position={p.position} hasAudio={!!p.hasAudio} />}
              </div>
            </li>
          ))}
        </ul>
        {f.pronunciations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="IPA-Zeichen einfügen">
            {IPA_KEYS.map((k) => (
              <button key={k} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertIpa(k)} className="font-lex grid h-10 min-w-10 place-items-center rounded-lg border-[1.5px] border-line px-2 text-lg hover:bg-table-2" aria-label={`Zeichen ${k} einfügen`}>
                {k.length === 1 && /[̀-ͯ]/.test(k) ? `◌${k}` : k}
              </button>
            ))}
          </div>
        )}
        <AddBtn onClick={() => set("pronunciations", [...f.pronunciations, { ipa: "", label: "", verified: true }])}>Aussprache hinzufügen</AddBtn>
      </section>

      <section aria-labelledby="h-ex">
        <h2 id="h-ex" className="section-title">
          Beispiele
        </h2>
        <ul className="mt-4 space-y-3">
          {f.examples.map((e, i) => (
            <li key={i} className="flex items-start gap-2">
              <label className="sr-only" htmlFor={`ex-${i}`}>
                Beispielsatz {i + 1}
              </label>
              <textarea id={`ex-${i}`} rows={2} maxLength={600} value={e} placeholder="Beispielsatz" onChange={(ev) => set("examples", f.examples.map((x, j) => (j === i ? ev.target.value : x)))} className="field lex-italic text-[1.05rem]" />
              <RemoveBtn label={`Beispiel ${i + 1} entfernen`} onClick={() => set("examples", f.examples.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ul>
        <AddBtn onClick={() => set("examples", [...f.examples, ""])}>Weiteres Beispiel</AddBtn>
      </section>

      <section className="space-y-5">
        <div>
          <label htmlFor="usage" className="label">
            Verwendung / Kontext
          </label>
          <textarea id="usage" rows={3} maxLength={2000} value={f.usage} onChange={(e) => set("usage", e.target.value)} className="field" />
        </div>
        <div>
          <label htmlFor="origin" className="label">
            Herkunft
          </label>
          <textarea id="origin" rows={2} maxLength={2000} value={f.origin} onChange={(e) => set("origin", e.target.value)} className="field" />
        </div>
        <div>
          <label htmlFor="variants" className="label">
            Andere Schreibweisen <span className="font-normal text-ink-3">(mit Komma trennen)</span>
          </label>
          <input id="variants" value={f.variants.join(", ")} onChange={(e) => set("variants", e.target.value.split(",").map((x) => x.trimStart()))} className="field" maxLength={600} />
        </div>
      </section>

      <section aria-labelledby="h-cat">
        <h2 id="h-cat" className="section-title">
          Kategorien
        </h2>
        {categories.length === 0 ? (
          <p className="mt-2 text-ink-2">
            Noch keine Kategorien. <a href="/k/kategorien" className="font-semibold text-ink underline">Anlegen</a>
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = f.categoryIds.includes(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => set("categoryIds", on ? f.categoryIds.filter((x) => x !== c.id) : [...f.categoryIds, c.id])} className={`chip ${bandClass(c.color)}`}>
                  <span className="size-2.5 rounded-full" style={{ background: "var(--band)" }} aria-hidden />
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
        <p className="hint">Erste Kategorie = Kartenfarbe.</p>
      </section>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center gap-3 border-t border-line bg-table/95 px-4 py-3 backdrop-blur-sm md:bottom-0">
        <button type="button" onClick={save} className="btn btn-primary" disabled={saving}>
          {saving && <Loader2 className="animate-spin" size={18} aria-hidden />} Speichern
        </button>
        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`text-[0.95rem] font-semibold ${msg.ok ? "text-yes" : "text-no"}`}>
            {msg.t}
          </p>
        )}
      </div>
    </div>
  );
}

function AddBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="btn btn-quiet btn-sm mt-3">
      <Plus size={16} aria-hidden /> {children}
    </button>
  );
}

function RemoveBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid size-11 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-table-2 hover:text-no">
      <X size={18} aria-hidden />
    </button>
  );
}

function AudioUpload({ wordId, position, hasAudio }: { wordId: string; position: number; hasAudio: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = `/api/audio/${wordId}/${position}`;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[0.9rem]">
      {hasAudio && <audio src={url} controls preload="none" className="h-9 max-w-52" />}
      <label className="btn btn-quiet btn-sm cursor-pointer">
        {busy ? <Loader2 className="animate-spin" size={15} aria-hidden /> : <Mic size={15} aria-hidden />}
        {hasAudio ? "Aufnahme ersetzen" : "Aufnahme hinzufügen"}
        <input
          type="file"
          accept="audio/*"
          capture="user"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setErr(null);
            const res = await fetch(url, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
            setBusy(false);
            if (!res.ok) setErr((await res.json().catch(() => null))?.error ?? "Upload fehlgeschlagen.");
            router.refresh();
          }}
        />
      </label>
      {hasAudio && (
        <button
          type="button"
          className="grid size-9 place-items-center rounded-full text-ink-3 hover:text-no"
          aria-label="Aufnahme löschen"
          onClick={async () => {
            if (!confirm("Aufnahme löschen?")) return;
            await fetch(url, { method: "DELETE" });
            router.refresh();
          }}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      )}
      {err && <span className="font-semibold text-no">{err}</span>}
    </div>
  );
}

const CONF = { hoch: "sicher", mittel: "eher sicher", niedrig: "unsicher" } as const;

function AiDraftView({ s, categories, onApply, onDiscard }: { s: Suggestion; categories: { name: string }[]; onApply: (field: string) => void; onDiscard: () => void }) {
  const rows: [string, string, React.ReactNode][] = [];
  if (s.shortDefinition) rows.push(["shortDefinition", "Definition", <>{s.shortDefinition}{s.meaning && <span className="block text-ink-2">{s.meaning}</span>}</>]);
  if (s.partOfSpeech) rows.push(["partOfSpeech", "Wortart", POS_LABEL[s.partOfSpeech]]);
  if (s.ipa) rows.push(["ipa", `Lautschrift (${s.ipaConfidence ? CONF[s.ipaConfidence] : "ohne Angabe"})`, <span key="i" className="ipa">{s.ipa}</span>]);
  if (s.example) rows.push(["example", "Beispiel", <span key="e" className="lex-italic">„{s.example}“</span>]);
  if (s.origin) rows.push(["origin", `Herkunft (${s.originConfidence ? CONF[s.originConfidence] : "ohne Angabe"})`, s.origin]);
  if (s.variants.length) rows.push(["variants", "Schreibweisen", s.variants.join(", ")]);
  const known = s.categories.filter((n) => categories.some((c) => c.name.toLowerCase() === n.toLowerCase()));
  const unknown = s.categories.filter((n) => !known.includes(n));
  if (known.length) rows.push(["categories", "Kategorien", known.join(", ")]);
  return (
    <div className="mt-3">
      {s.caveats && <p className="mb-3 rounded-xl bg-later/15 px-3 py-2 text-[0.92rem]">{s.caveats}</p>}
      {rows.length === 0 && <p className="text-ink-2">Keine Vorschläge.</p>}
      <dl className="divide-y divide-line">
        {rows.map(([field, label, value]) => (
          <div key={field} className="flex items-start justify-between gap-3 py-2.5">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-ink-3">{label}</dt>
              <dd className="mt-0.5">{value}</dd>
            </div>
            <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={() => onApply(field)}>
              Übernehmen
            </button>
          </div>
        ))}
      </dl>
      {unknown.length > 0 && <p className="mt-2 text-sm text-ink-2">Nicht vorhanden: {unknown.join(", ")}</p>}
      <button type="button" onClick={onDiscard} className="mt-3 text-sm font-semibold text-ink-2 underline">
        Entwurf verwerfen
      </button>
    </div>
  );
}
