import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/access";
import { can } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";
import { BulkTagger, RetagButton } from "./client";

export const metadata: Metadata = { title: "Datenbank pflegen", robots: { index: false } };
export const dynamic = "force-dynamic";

// Each gap is a filter over the collection. Order = what makes an entry most useful first.
const GAPS = {
  beschreibung: { label: "ohne Beschreibung", where: { definitions: { none: {} } } },
  kategorie: { label: "ohne Kategorie", where: { categories: { none: {} } } },
  wortart: { label: "ohne Wortart", where: { partOfSpeech: null } },
  lautschrift: { label: "ohne Lautschrift", where: { pronunciations: { none: {} } } },
  unbestaetigt: { label: "Lautschrift unbestätigt", where: { pronunciations: { some: { verified: false } } } },
  beispiel: { label: "ohne Beispiel", where: { examples: { none: {} } } },
  herkunft: { label: "ohne Herkunft", where: { origin: null } },
  autotags: { label: "Auto-Tags prüfen", where: { categories: { some: { auto: true } } } },
} satisfies Record<string, { label: string; where: Prisma.WordWhereInput }>;
type Gap = keyof typeof GAPS;

export default async function Pflege({ searchParams }: { searchParams: Promise<{ luecke?: string }> }) {
  const v = await requireMemberPage();
  if (!can(v, "edit") && !can(v, "tags")) redirect("/");
  const sp = await searchParams;
  const gap = (sp.luecke && sp.luecke in GAPS ? sp.luecke : null) as Gap | null;
  const base = { status: "ACCEPTED" } satisfies Prisma.WordWhereInput;

  const [total, counts, words, categories] = await Promise.all([
    db.word.count({ where: base }),
    Promise.all((Object.keys(GAPS) as Gap[]).map(async (k) => [k, await db.word.count({ where: { ...base, ...GAPS[k].where } })] as const)),
    db.word.findMany({
      where: { ...base, ...(gap ? GAPS[gap].where : {}) },
      orderBy: { normalized: "asc" },
      take: 300,
      select: {
        id: true,
        term: true,
        slug: true,
        partOfSpeech: true,
        origin: true,
        _count: { select: { definitions: true, examples: true, pronunciations: true } },
        categories: { select: { auto: true, category: { select: { id: true, name: true } } } },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const noDesc = counts.find(([k]) => k === "beschreibung")?.[1] ?? 0;
  const complete = total ? Math.round(((total - noDesc) / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Datenbank pflegen</h1>
      <p className="mt-2 text-ink-2">
        <span className="tabular font-bold text-ink">{total}</span> Wörter im Archiv · <span className="tabular font-bold text-ink">{complete} %</span> mit Beschreibung
      </p>

      <nav aria-label="Lücken" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Link href="/pflege" className="chip" aria-current={!gap ? "true" : undefined}>
          Alle
        </Link>
        {counts.map(([k, n]) => (
          <Link key={k} href={`/pflege?luecke=${k}`} className="chip" aria-current={gap === k ? "true" : undefined}>
            {GAPS[k].label} <span className="tabular text-[0.8em] opacity-70">{n}</span>
          </Link>
        ))}
      </nav>

      {can(v, "tags") && (
        <div className="mt-4">
          <RetagButton />
        </div>
      )}

      <BulkTagger
        canTag={can(v, "tags")}
        canEdit={can(v, "edit")}
        categories={categories}
        words={words.map((w) => ({
          id: w.id,
          term: w.term,
          slug: w.slug,
          tags: w.categories.map((c) => ({ name: c.category.name, auto: c.auto })),
          gaps: [
            !w._count.definitions && "Beschreibung",
            !w.categories.length && "Kategorie",
            !w.partOfSpeech && "Wortart",
            !w._count.pronunciations && "Lautschrift",
            !w._count.examples && "Beispiel",
            !w.origin && "Herkunft",
          ].filter((x): x is string => !!x),
        }))}
      />
      {words.length === 300 && <p className="mt-4 text-sm text-ink-3">Die ersten 300 Treffer.</p>}
    </div>
  );
}
