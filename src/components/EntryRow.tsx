import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { POS_LABEL, bandClass } from "@/lib/categories";
import { formatDate } from "@/lib/time";
import { Ipa } from "./WordCard";

type Tag = { auto?: boolean; category: { name: string; slug: string; color: string } };

/**
 * One dictionary line. Only the word is visible; a tap opens description,
 * acceptance date and tags (native <details>, no JS).
 */
export function EntryRow({
  slug,
  term,
  ipa,
  partOfSpeech,
  definition,
  acceptedAt,
  tags = [],
}: {
  slug: string;
  term: string;
  ipa?: string | null;
  partOfSpeech?: keyof typeof POS_LABEL | null;
  definition?: string | null;
  acceptedAt?: Date | null;
  tags?: Tag[];
}) {
  return (
    <li className="border-b border-line/70 last:border-b-0">
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <span lang="de" className="display text-[1.45rem] decoration-2 underline-offset-4 group-hover:underline">
            {term}
          </span>
          <ChevronDown size={18} className="shrink-0 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="pb-4 pl-0.5">
          <p className="leading-snug text-ink-2">
            {ipa && <Ipa ipa={ipa} verified className="mr-2 text-[0.95rem]" />}
            {partOfSpeech && <span className="lex-italic mr-1.5 text-ink-3">{POS_LABEL[partOfSpeech]} —</span>}
            {definition ?? <span className="text-ink-3">noch ohne Beschreibung</span>}
          </p>
          {tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
              {tags.map(({ category: c, auto }) => (
                <li key={c.slug}>
                  <Link href={`/woerter?kategorie=${c.slug}`} className={`chip ${bandClass(c.color)} text-sm`} title={auto ? "automatisch vergeben" : undefined}>
                    <span className="size-2 rounded-full" style={{ background: "var(--band)" }} aria-hidden />
                    {c.name}
                    {auto && <span className="sr-only">(automatisch)</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-3">
            {acceptedAt ? <span>aufgenommen am {formatDate(acceptedAt)}</span> : <span />}
            <Link href={`/wort/${slug}`} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
              Ganzer Eintrag <ArrowRight size={15} aria-hidden />
            </Link>
          </p>
        </div>
      </details>
    </li>
  );
}
