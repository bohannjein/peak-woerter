import Link from "next/link";
import { POS_LABEL } from "@/lib/categories";
import { Ipa } from "./WordCard";

/**
 * One dictionary line: **Lemma** [IPA] *Wortart* — Kurzdefinition.
 * Desktop reads as one scannable line; on phones the definition wraps below.
 */
export function EntryRow({
  slug,
  term,
  ipa,
  partOfSpeech,
  definition,
}: {
  slug: string;
  term: string;
  ipa?: string | null;
  partOfSpeech?: keyof typeof POS_LABEL | null;
  definition?: string | null;
}) {
  return (
    <li className="border-b border-line/70 last:border-b-0">
      <Link href={`/wort/${slug}`} className="group block min-h-14 py-3 md:grid md:grid-cols-[minmax(11rem,16rem)_1fr] md:items-baseline md:gap-6">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span lang="de" className="display text-[1.45rem] decoration-2 underline-offset-4 group-hover:underline">
            {term}
          </span>
          {ipa && <Ipa ipa={ipa} verified className="text-[0.95rem] text-ink-2" />}
        </span>
        <span className="mt-0.5 block leading-snug text-ink-2 md:mt-0">
          {partOfSpeech && <span className="lex-italic mr-1.5 text-ink-3">{POS_LABEL[partOfSpeech]} —</span>}
          {definition ?? <span className="text-ink-3">noch ohne Definition</span>}
        </span>
      </Link>
    </li>
  );
}
