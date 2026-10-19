"use client";

import { useEffect, useRef, useState } from "react";
import { Merge, Pencil, Trash2 } from "lucide-react";
import { BAND_COLORS, BAND_LABEL, bandClass } from "@/lib/categories";
import { deleteCategoryAction, mergeCategoryAction, saveCategoryAction } from "@/app/actions/words";
import { FormError, Toggle, useFormAction } from "@/components/form";
import { ActionButton } from "@/components/ActionButton";

type Cat = { id: string; name: string; color: string; nsfw: boolean; keywords: string[]; count: number };

function ColorPicker({ value }: { value?: string }) {
  return (
    <fieldset>
      <legend className="label">Farbe</legend>
      <div className="flex flex-wrap gap-2">
        {BAND_COLORS.map((c) => (
          <label key={c} className={`${bandClass(c)} cursor-pointer`}>
            <input type="radio" name="color" value={c} defaultChecked={(value ?? "cobalt") === c} className="peer sr-only" />
            <span className="block size-10 rounded-full border-[3px] border-transparent peer-checked:border-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-focus" style={{ background: "var(--band)" }} title={BAND_LABEL[c]} />
            <span className="sr-only">{BAND_LABEL[c]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CatForm({ cat, onDone }: { cat?: Cat; onDone?: () => void }) {
  const [state, action, pending] = useFormAction(saveCategoryAction.bind(null, cat?.id ?? null));
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      onDone?.();
    }
  }, [state, onDone]);
  return (
    <form ref={ref} onSubmit={action} className="space-y-4">
      <div>
        <label htmlFor={`n-${cat?.id ?? "neu"}`} className="label">
          Name
        </label>
        <input id={`n-${cat?.id ?? "neu"}`} name="name" required maxLength={40} defaultValue={cat?.name} className="field" />
      </div>
      <ColorPicker value={cat?.color} />
      <div>
        <label htmlFor={`k-${cat?.id ?? "neu"}`} className="label">
          Stichwörter für automatisches Taggen <span className="font-normal text-ink-3">(mit Komma getrennt)</span>
        </label>
        <input id={`k-${cat?.id ?? "neu"}`} name="keywords" defaultValue={cat?.keywords.join(", ")} className="field" placeholder="z. B. essen, koch, küche" />
        <p className="hint">Wörter, deren Text ein Wort mit diesem Anfang enthält, bekommen die Kategorie automatisch.</p>
      </div>
      <Toggle name="nsfw" label="18+ / nicht jugendfrei" hint="Wörter mit dieser Kategorie sind im SFW-Modus ausgeblendet." defaultChecked={cat?.nsfw} />
      <FormError state={state} />
      <button className="btn btn-primary" disabled={pending}>
        {cat ? "Speichern" : "Kategorie anlegen"}
      </button>
    </form>
  );
}

export function CategoryManager({ categories }: { categories: Cat[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);
  return (
    <div className="mt-8">
      <ul>
        {categories.map((c) => (
          <li key={c.id} className="border-t border-line py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className={`${bandClass(c.color)} flex items-center gap-3`}>
                <span className="size-4 rounded-full" style={{ background: "var(--band)" }} aria-hidden />
                <span className="text-lg font-bold">{c.name}</span>
                <span className="tabular text-sm text-ink-3">{c.count} Wörter</span>
                {c.nsfw && <span className="rounded-full bg-no px-2 py-0.5 text-xs font-bold text-white">18+</span>}
                {c.keywords.length > 0 && <span className="text-sm text-ink-3">auto: {c.keywords.join(", ")}</span>}
              </span>
              <span className="flex gap-1">
                <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-table-2" aria-label={`${c.name} bearbeiten`} onClick={() => setEditing(editing === c.id ? null : c.id)}>
                  <Pencil size={17} aria-hidden />
                </button>
                {categories.length > 1 && (
                  <button type="button" className="grid size-10 place-items-center rounded-full hover:bg-table-2" aria-label={`${c.name} zusammenführen`} onClick={() => setMerging(merging === c.id ? null : c.id)}>
                    <Merge size={17} aria-hidden />
                  </button>
                )}
                <ActionButton
                  action={deleteCategoryAction.bind(null, c.id)}
                  className="grid size-10 place-items-center rounded-full hover:bg-table-2 hover:text-no"
                  confirm={`„${c.name}“ löschen?`}
                >
                  <Trash2 size={17} aria-label={`${c.name} löschen`} />
                </ActionButton>
              </span>
            </div>
            {editing === c.id && (
              <div className="mt-4 rounded-2xl border-[1.5px] border-line p-4">
                <CatForm cat={c} onDone={() => setEditing(null)} />
              </div>
            )}
            {merging === c.id && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border-[1.5px] border-line p-4">
                <span className="text-[0.95rem]">Zusammenführen mit:</span>
                {categories
                  .filter((o) => o.id !== c.id)
                  .map((o) => (
                    <ActionButton key={o.id} action={mergeCategoryAction.bind(null, c.id, o.id)} confirm={`„${c.name}“ mit „${o.name}“ zusammenführen?`}>
                      {o.name}
                    </ActionButton>
                  ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <section className="mt-10 border-t-2 border-ink pt-6">
        <h2 className="section-title mb-4">Neue Kategorie</h2>
        <CatForm />
      </section>
    </div>
  );
}
