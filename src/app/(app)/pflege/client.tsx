"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { bulkTagAction, retagAllAction } from "@/app/actions/words";

type W = { id: string; term: string; slug: string; tags: { name: string; auto: boolean }[]; gaps: string[] };

export function BulkTagger({ words, categories, canTag, canEdit }: { words: W[]; categories: { id: string; name: string }[]; canTag: boolean; canEdit: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [cat, setCat] = useState(categories[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const run = (add: boolean) =>
    start(async () => {
      const r = await bulkTagAction([...sel], cat, add);
      setMsg(r.ok ? { ok: true, t: `${r.data} Wörter ${add ? "getaggt" : "entfernt"}.` } : { ok: false, t: r.error });
      if (r.ok) setSel(new Set());
    });

  if (words.length === 0) return <p className="mt-12 text-lg text-ink-3">Nichts zu tun. Sauber.</p>;
  return (
    <div className="mt-6">
      {canTag && categories.length > 0 && (
        <div className="sticky top-16 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-table/95 px-4 py-3 backdrop-blur-sm md:mx-0 md:rounded-2xl md:border">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="size-5 accent-[var(--ink)]"
              checked={sel.size === words.length}
              onChange={(e) => setSel(e.target.checked ? new Set(words.map((w) => w.id)) : new Set())}
            />
            {sel.size} gewählt
          </label>
          <label htmlFor="bulk-cat" className="sr-only">
            Kategorie
          </label>
          <select id="bulk-cat" value={cat} onChange={(e) => setCat(e.target.value)} className="field h-10 w-auto py-0">
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-sm" disabled={!sel.size || pending} onClick={() => run(true)}>
            Taggen
          </button>
          <button type="button" className="btn btn-quiet btn-sm" disabled={!sel.size || pending} onClick={() => run(false)}>
            Tag entfernen
          </button>
          {pending && <Loader2 className="animate-spin" size={18} aria-label="Speichert" />}
          {msg && (
            <span role={msg.ok ? "status" : "alert"} className={`text-sm font-semibold ${msg.ok ? "text-yes" : "text-no"}`}>
              {msg.t}
            </span>
          )}
        </div>
      )}
      <ul>
        {words.map((w) => (
          <li key={w.id} className="flex items-start gap-3 border-b border-line/70 py-3">
            {canTag && (
              <input type="checkbox" aria-label={`${w.term} auswählen`} className="mt-2 size-5 shrink-0 accent-[var(--ink)]" checked={sel.has(w.id)} onChange={() => toggle(w.id)} />
            )}
            <div className="min-w-0 flex-1">
              <Link href={canEdit ? `/k/wort/${w.id}/bearbeiten` : `/wort/${w.slug}`} className="display text-[1.4rem] hover:underline">
                {w.term}
              </Link>
              <p className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
                {w.tags.map((t) => (
                  <span
                    key={t.name}
                    className={`rounded-full px-2 py-0.5 ${t.auto ? "border-[1.5px] border-dashed border-line text-ink-2" : "bg-table-3"}`}
                    title={t.auto ? "automatisch vergeben" : undefined}
                  >
                    {t.name}
                    {t.auto && " (auto)"}
                  </span>
                ))}
                {w.gaps.map((g) => (
                  <span key={g} className="rounded-full bg-later/25 px-2 py-0.5 text-ink">
                    fehlt: {g}
                  </span>
                ))}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RetagButton() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn btn-quiet btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await retagAllAction();
            setDone(r.ok ? "Fertig." : r.error);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" size={17} aria-hidden /> : <Wand2 size={17} aria-hidden />} Alle Wörter automatisch taggen
      </button>
      {done && (
        <span role="status" className="text-sm font-semibold text-ink-2">
          {done}
        </span>
      )}
    </span>
  );
}
