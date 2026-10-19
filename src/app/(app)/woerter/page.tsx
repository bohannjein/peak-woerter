import Link from "next/link";
import type { Metadata } from "next";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { db } from "@/lib/db";
import { listPublicWords, publicCategories } from "@/lib/queries";
import { bandClass } from "@/lib/categories";
import { MiniCard } from "@/components/WordCard";
import { EntryRow } from "@/components/EntryRow";
import { sfwOn } from "@/lib/sfw";
import { normalizeTerm } from "@/lib/text";

export const metadata: Metadata = { title: "Sammlung" };
export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; kategorie?: string; sort?: string; ansicht?: string }>;

function initial(term: string) {
  const c = term.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

export default async function Sammlung({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sort = sp.sort === "neu" || sp.sort === "kat" ? sp.sort : "az";
  const view = sp.ansicht === "karten" ? "karten" : "liste";
  const q = sp.q?.slice(0, 100);
  const sfw = await sfwOn();
  const [words, cats] = await Promise.all([listPublicWords(db, { q, kategorie: sp.kategorie, sort, sfw }), publicCategories(db, sfw)]);

  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, kategorie: sp.kategorie, sort: sort === "az" ? undefined : sort, ansicht: view === "liste" ? undefined : view, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/woerter?${s}` : "/woerter";
  };

  const groups = new Map<string, typeof words>();
  const add = (k: string, w: (typeof words)[number]) => groups.set(k, [...(groups.get(k) ?? []), w]);
  if (sort === "az") for (const w of words) add(initial(w.term), w);
  if (sort === "kat") {
    for (const w of words) for (const c of w.categories.length ? w.categories.map((c) => c.category.name) : ["Ohne Kategorie"]) add(c, w);
  }
  const grouped = sort === "neu" ? [["", words] as const] : [...groups.entries()].sort(([a], [b]) => (sort === "kat" ? a.localeCompare(b, "de") : 0));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title">Sammlung</h1>
        <p className="tabular text-sm text-ink-2">
          {words.length} {words.length === 1 ? "Wort" : "Wörter"}
          
        </p>
      </div>

      <form action="/woerter" role="search" className="mt-4 flex gap-2">
        {sp.kategorie && <input type="hidden" name="kategorie" value={sp.kategorie} />}
        {sort !== "az" && <input type="hidden" name="sort" value={sort} />}
        {view !== "liste" && <input type="hidden" name="ansicht" value={view} />}
        <label htmlFor="suche" className="sr-only">
          Suchen
        </label>
        <input id="suche" name="q" type="search" defaultValue={q} placeholder="Suchen" className="field" autoComplete="off" enterKeyHint="search" />
        <button className="btn btn-primary shrink-0 px-4" aria-label="Suchen">
          <Search size={20} strokeWidth={2.4} aria-hidden />
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
        <nav aria-label="Kategorien" className="-mx-4 flex w-[calc(100%+2rem)] flex-nowrap gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:w-auto md:min-w-0 md:flex-1 md:flex-wrap md:px-0">
          <Link href={href({ kategorie: undefined })} className="chip" aria-current={!sp.kategorie ? "true" : undefined}>
            Alle
          </Link>
          {cats.map((c) => (
            <Link key={c.slug} href={href({ kategorie: c.slug })} className={`chip ${bandClass(c.color)}`} aria-current={sp.kategorie === c.slug ? "true" : undefined}>
              <span className="size-2.5 rounded-full" style={{ background: "var(--band)" }} aria-hidden />
              {c.name}
              <span className="tabular text-[0.8em] opacity-70">{c._count.words}</span>
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-full border-[1.5px] border-line p-0.5" role="group" aria-label="Sortierung">
            <Link href={href({ sort: undefined })} className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold md:min-h-0 md:py-1.5 ${sort === "az" ? "bg-ink text-table" : "text-ink-2"}`} aria-current={sort === "az" ? "true" : undefined}>
              A–Z
            </Link>
            <Link href={href({ sort: "neu" })} className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold md:min-h-0 md:py-1.5 ${sort === "neu" ? "bg-ink text-table" : "text-ink-2"}`} aria-current={sort === "neu" ? "true" : undefined}>
              Neueste
            </Link>
            <Link href={href({ sort: "kat" })} className={`inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold md:min-h-0 md:py-1.5 ${sort === "kat" ? "bg-ink text-table" : "text-ink-2"}`} aria-current={sort === "kat" ? "true" : undefined}>
              Kategorien
            </Link>
          </div>
          <div className="flex rounded-full border-[1.5px] border-line p-0.5" role="group" aria-label="Ansicht">
            <Link href={href({ ansicht: undefined })} className={`grid size-11 place-items-center rounded-full md:size-9 ${view === "liste" ? "bg-ink text-table" : "text-ink-2"}`} aria-label="Listenansicht" aria-current={view === "liste" ? "true" : undefined}>
              <List size={18} aria-hidden />
            </Link>
            <Link href={href({ ansicht: "karten" })} className={`grid size-11 place-items-center rounded-full md:size-9 ${view === "karten" ? "bg-ink text-table" : "text-ink-2"}`} aria-label="Kartenansicht" aria-current={view === "karten" ? "true" : undefined}>
              <LayoutGrid size={18} aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {q && /^peake?$/.test(normalizeTerm(q)) && (
        <p className="mt-4 font-semibold text-ink-2">Du suchst den Gipfel? Du stehst drauf.</p>
      )}

      {words.length === 0 ? (
        <div className="mt-16 max-w-md">
          <p className="section-title">{q || sp.kategorie ? "Keine Wörter gefunden" : "Noch keine Wörter"}</p>
          {(q || sp.kategorie) && (
            <Link href="/woerter" className="btn btn-quiet mt-5">
              <X size={18} aria-hidden /> Filter zurücksetzen
            </Link>
          )}
        </div>
      ) : view === "karten" ? (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {words.map((w) => (
            <li key={w.id}>
              <Link href={`/wort/${w.slug}`} className="group block h-48 rounded-[20px]">
                <MiniCard term={w.term} cardNumber={w.cardNumber} band={w.categories[0]?.category} definition={w.definitions[0]?.text} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          {grouped.map(([letter, list]) => (
            <section key={letter || "all"} className="md:grid md:grid-cols-[2.5rem_1fr] md:gap-x-4" aria-label={letter || undefined}>
              {letter && (
                <h2 className={`display border-b border-line pb-1 pt-5 text-xl text-ink-3 md:self-start md:border-0 md:pt-3 ${sort === "kat" ? "md:col-span-2" : "md:sticky md:top-20"}`}>{letter}</h2>
              )}
              <ul className={letter && sort === "az" ? "" : "md:col-span-2"}>
                {list.map((w) => (
                  <EntryRow
                    key={w.id}
                    slug={w.slug}
                    term={w.term}
                    ipa={w.pronunciations.find((p) => p.verified)?.ipa}
                    partOfSpeech={w.partOfSpeech}
                    definition={w.definitions[0]?.text}
                    acceptedAt={w.acceptedAt}
                    tags={w.categories}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
