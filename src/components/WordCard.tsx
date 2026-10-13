import { bandClass, cardNo, POS_LABEL } from "@/lib/categories";
import { letterCount } from "@/lib/text";

export type CardData = {
  term: string;
  cardNumber?: number | null;
  band?: { name: string; color: string } | null;
  /** Shown in the band when there is no category, e.g. "Neu", "Neubewertung". */
  bandLabel?: string;
  partOfSpeech?: keyof typeof POS_LABEL | null;
  grammar?: string | null;
  ipa?: { ipa: string; verified: boolean } | null;
  definition?: string | null;
  example?: string | null;
  values?: [string, string | number][];
};

/** Fits long German compounds: font size shrinks with length, floor 2rem. */
function termSize(term: string, max: number) {
  const len = Math.max(letterCount(term), 5);
  return `clamp(1.6rem, ${Math.round(168 / len)}cqi, ${max}rem)`;
}

export function Ipa({ ipa, verified, className = "" }: { ipa: string; verified: boolean; className?: string }) {
  return (
    <span className={`ipa ${className}`} lang="und-fonipa" aria-label={`Lautschrift ${ipa}${verified ? "" : ", unbestätigt"}`}>
      {ipa}
      {!verified && (
        <sup className="ml-0.5 font-sans text-[0.6em] font-bold not-italic opacity-70" title="Lautschrift noch nicht bestätigt">
          ?
        </sup>
      )}
    </span>
  );
}

export function WordCard({
  data,
  className = "",
  headingLevel = 2,
  compact = false,
  children,
}: {
  data: CardData;
  className?: string;
  headingLevel?: 1 | 2 | 3;
  /** Smaller term and spacing, for highlights inside reading pages. */
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const H = `h${headingLevel}` as "h1";
  const pos = [data.partOfSpeech ? POS_LABEL[data.partOfSpeech] : null, data.grammar].filter(Boolean).join(", ");
  const no = cardNo(data.cardNumber);
  return (
    <article className={`card-stock ${bandClass(data.band?.color)} flex flex-col overflow-hidden [container-type:inline-size] ${className}`}>
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 px-5" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
        <span className="condensed truncate text-[0.82rem] font-extrabold uppercase tracking-[0.08em]">
          {data.band?.name ?? data.bandLabel ?? "Peake Wörter"}
        </span>
        {no && <span className="condensed tabular text-[0.95rem] font-black">{no}</span>}
      </div>

      <div className={`flex flex-1 flex-col px-5 pb-4 sm:px-6 ${compact ? "pt-4" : "pt-5"}`}>
        <H lang="de" className="display hyphens-auto break-words" style={{ fontSize: termSize(data.term, compact ? 3 : 4.25) }}>
          {data.term}
        </H>
        {(pos || data.ipa) && (
          <p className="mt-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-card-ink-2">
            {pos && <span className="text-[0.92rem] font-semibold">{pos}</span>}
            {data.ipa && <Ipa {...data.ipa} className="text-[1.08rem] text-card-ink" />}
          </p>
        )}
        {data.definition && <p className="mt-3 text-[1.06rem] leading-snug text-card-ink [text-wrap:pretty]">{data.definition}</p>}
        {data.example && (
          <p className="lex-italic mt-3 text-[1.02rem] leading-snug text-card-ink-2 [text-wrap:pretty]">„{data.example}“</p>
        )}
        {children}
        {!children && !data.definition && !data.example && !data.ipa && (
          // Empty index-card lines: the entry is honestly missing, the card still reads as a card.
          <div
            className="mt-5 flex min-h-24 flex-1 flex-col justify-end"
            aria-label="Noch kein Eintrag"
            style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 31px, var(--card-line) 31px 32px)" }}
          >
            <p className="lex-italic bg-card pr-2 text-[0.95rem] text-card-ink-2 self-start">Eintrag folgt.</p>
          </div>
        )}

        {data.values && data.values.length > 0 && (
          <dl className={`mt-auto grid grid-cols-2 gap-x-5 ${compact ? "pt-3" : "pt-5"}`}>
            {data.values.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2 border-t border-card-line py-1.5">
                <dt className="condensed whitespace-nowrap text-[0.72rem] font-bold uppercase tracking-[0.07em] text-card-ink-2">{k}</dt>
                <dd className="tabular condensed whitespace-nowrap text-[0.98rem] font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </article>
  );
}

/** Compact card for the deck grid and strips. */
export function MiniCard({ term, cardNumber, band, definition }: Pick<CardData, "term" | "cardNumber" | "band" | "definition">) {
  const no = cardNo(cardNumber);
  return (
    <div className={`card-stock ${bandClass(band?.color)} flex h-full flex-col overflow-hidden [container-type:inline-size] transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-translate-y-1 group-focus-visible:-translate-y-1`}>
      <div className="flex h-7 items-center justify-between px-3.5" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
        <span className="condensed truncate text-[0.66rem] font-extrabold uppercase tracking-[0.08em]">{band?.name ?? ""}</span>
        {no && <span className="condensed tabular text-[0.72rem] font-black">{no}</span>}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <span lang="de" className="display hyphens-auto break-words" style={{ fontSize: termSize(term, 2.2).replace("2rem", "1.35rem") }}>
          {term}
        </span>
        {definition && <span className="mt-2 line-clamp-3 text-[0.86rem] leading-snug text-card-ink-2">{definition}</span>}
      </div>
    </div>
  );
}
