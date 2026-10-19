import Link from "next/link";
import { Search, Shuffle } from "lucide-react";
import { db } from "@/lib/db";
import { getWordOfDay } from "@/lib/daily";
import { publicCategories, publicEntrySelect, publicWhere } from "@/lib/queries";
import { sfwOn } from "@/lib/sfw";
import { WordOfYear } from "@/components/WordOfYear";
import { toCard } from "@/lib/cards";
import { bandClass } from "@/lib/categories";
import { formatDate } from "@/lib/time";
import { WordCard } from "@/components/WordCard";
import { EntryRow } from "@/components/EntryRow";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sfw = await sfwOn();
  const where = publicWhere(sfw);
  const [daily, latest, total, cats] = await Promise.all([
    getWordOfDay(db),
    db.word.findMany({ where, select: publicEntrySelect, orderBy: { acceptedAt: "desc" }, take: 8 }),
    db.word.count({ where }),
    publicCategories(db, sfw),
  ]);
  // In SFW mode an NSFW word of the day is simply not shown.
  const dailyFull = daily ? await db.word.findFirst({ where: { ...where, id: daily.id }, select: publicEntrySelect }) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 md:pt-10">
      <header className="max-w-2xl">
        <h1 className="page-title">Peake Wörter</h1>
        <p className="mt-1.5 text-ink-2">Unser kleines Archiv für bemerkenswerte Begriffe.</p>
        <form action="/woerter" className="mt-5 flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            Wort suchen
          </label>
          <input id="q" name="q" type="search" placeholder="Suchen" className="field" autoComplete="off" enterKeyHint="search" />
          <button className="btn btn-primary shrink-0 px-4" aria-label="Suchen">
            <Search size={20} strokeWidth={2.4} aria-hidden />
          </button>
        </form>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
          <Link href="/woerter" className="hover:text-ink">
            <span className="tabular font-bold text-ink">{total}</span> {total === 1 ? "Wort" : "Wörter"}
          </Link>
          {total > 0 && (
            <Link href="/zufall" className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
              <Shuffle size={15} aria-hidden /> Zufälliges Wort
            </Link>
          )}
        </p>
      </header>

      <WordOfYear />

      {total === 0 ? (
        <p className="mt-12 text-ink-2">Noch keine Wörter.</p>
      ) : (
        <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-[minmax(0,21rem)_1fr]">
          {dailyFull && (
            <section aria-labelledby="wdt">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 id="wdt" className="section-title">
                  Wort des Tages
                </h2>
                <time className="text-sm text-ink-3" dateTime={new Date().toISOString().slice(0, 10)}>
                  {formatDate(new Date(), { weekday: "short", day: "numeric", month: "long" })}
                </time>
              </div>
              <Link href={`/wort/${dailyFull.slug}`} className="group block rounded-[20px]">
                <WordCard compact data={{ ...toCard(dailyFull), values: undefined }} className="transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-translate-y-0.5" />
              </Link>
            </section>
          )}

          <div className="space-y-10">
            <section aria-labelledby="neu">
              <div className="flex items-baseline justify-between border-b border-line pb-2">
                <h2 id="neu" className="section-title">
                  Zuletzt hinzugefügt
                </h2>
                <Link href="/woerter?sort=neu" className="text-sm font-semibold text-ink-2 hover:text-ink">
                  Alle Wörter
                </Link>
              </div>
              <ul>
                {latest.map((w) => (
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

            {cats.length > 0 && (
              <section aria-labelledby="kat">
                <h2 id="kat" className="section-title border-b border-line pb-2">
                  Kategorien
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {cats.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/woerter?kategorie=${c.slug}`} className={`chip ${bandClass(c.color)}`}>
                        <span className="size-2.5 rounded-full" style={{ background: "var(--band)" }} aria-hidden />
                        {c.name}
                        <span className="tabular text-[0.8em] text-ink-3">{c._count.words}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
