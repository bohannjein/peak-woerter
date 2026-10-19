import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Pencil, Shuffle } from "lucide-react";
import { db } from "@/lib/db";
import { getPublicEntry, publicWhere } from "@/lib/queries";
import { sfwOn } from "@/lib/sfw";
import { can } from "@/lib/permissions";
import { ChallengeButton, FavoriteButton } from "@/components/WordMemberActions";
import { getViewer } from "@/lib/access";
import { toCard } from "@/lib/cards";
import { POS_LABEL, bandClass, cardNo } from "@/lib/categories";
import { formatDate } from "@/lib/time";
import { WordCard, Ipa } from "@/components/WordCard";
import { ShareButton } from "@/components/ShareButton";
import { AudioButton } from "@/components/AudioButton";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const w = await getPublicEntry(db, (await params).slug);
  if (!w) return { title: "Nicht gefunden" };
  const description = w.definitions[0]?.text ?? `${w.term} – aus der Sammlung von Peake Wörter.`;
  return { title: w.term, description, openGraph: { title: `${w.term} · Peake Wörter`, description, type: "article" } };
}

export default async function WordPage({ params }: P) {
  const { slug } = await params;
  const sfw = await sfwOn();
  const w = await getPublicEntry(db, slug, sfw);
  if (!w) {
    if (sfw && (await getPublicEntry(db, slug))) {
      return (
        <div className="mx-auto max-w-xl px-4 pt-16">
          <p className="page-title">Im SFW-Modus ausgeblendet.</p>
          <p className="mt-3 text-ink-2">Dieses Wort ist als 18+ getaggt. Zum Ansehen den SFW-Modus oben ausschalten.</p>
        </div>
      );
    }
    notFound();
  }
  const viewer = await getViewer();
  const [fans, me, openRound] = viewer
    ? await Promise.all([
        db.user.findMany({ where: { favoriteWordId: w.id, disabled: false }, select: { id: true, name: true } }),
        db.user.findUnique({ where: { id: viewer.id }, select: { favoriteWordId: true } }),
        db.votingRound.findFirst({ where: { wordId: w.id, closedAt: null }, select: { id: true } }),
      ])
    : [[], null, null];
  const pron = w.pronunciations.filter((p) => p.verified);
  const catIds = w.categories.map((c) => c.category.slug);
  const related = catIds.length
    ? await db.word.findMany({
        where: { ...publicWhere(sfw), id: { not: w.id }, categories: { some: { category: { slug: { in: catIds } } } } },
        select: { term: true, slug: true },
        orderBy: { normalized: "asc" },
        take: 8,
      })
    : [];
  const pos = [w.partOfSpeech ? POS_LABEL[w.partOfSpeech] : null, w.grammar].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-6 md:pt-10">
      <Link href="/woerter" className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Sammlung
      </Link>

      <div className="mt-5 grid gap-12 md:grid-cols-[minmax(0,1fr)_18rem] md:gap-16">
        <article>
          <header>
            <h1 lang="de" className="display hyphens-auto break-words text-[clamp(2.75rem,10vw,4.75rem)]">
              {w.term}
            </h1>
            {(pos || pron.length > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                {pos && <span className="lex-italic text-xl text-ink-2">{pos}</span>}
                {pron.map((p) => (
                  <span key={p.position} className="inline-flex items-center gap-2">
                    <Ipa ipa={p.ipa} verified className="text-[1.35rem]" />
                    {p.label && <span className="text-sm text-ink-3">{p.label}</span>}
                    {p.audioPath && <AudioButton src={`/api/audio/${w.id}/${p.position}`} term={w.term} />}
                  </span>
                ))}
              </div>
            )}
            {w.variants.length > 0 && <p className="mt-2 text-ink-2">auch: {w.variants.join(", ")}</p>}
          </header>

          {/* Dictionary setting: numbered senses, examples run in, run-in heads. */}
          <div className="mt-7 max-w-[40rem] border-t border-line pt-6">
            {w.definitions.length > 0 && (
              <ol className="space-y-4">
                {w.definitions.map((d) => (
                  <li key={d.position} className={w.definitions.length > 1 ? "grid grid-cols-[2rem_1fr]" : ""}>
                    {w.definitions.length > 1 && <span className="display tabular pt-0.5 text-[1.6rem] text-ink-3">{d.position}.</span>}
                    <span>
                      <span className="text-[1.3rem] leading-snug [text-wrap:pretty]">{d.text}</span>
                      {d.detail && <span className="mt-1 block text-ink-2">{d.detail}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {w.examples.length > 0 && (
              <ul className="mt-5 space-y-2">
                {w.examples.map((e, i) => (
                  <li key={i} className="lex-italic text-[1.2rem] leading-snug text-ink-2">
                    „{e.text}“
                  </li>
                ))}
              </ul>
            )}
            {w.usage && (
              <p className="mt-6 whitespace-pre-line leading-relaxed">
                <strong className="font-bold">Verwendung:</strong> {w.usage}
              </p>
            )}
            {w.origin && (
              <p className="mt-3 whitespace-pre-line leading-relaxed">
                <strong className="font-bold">Herkunft:</strong> {w.origin}
              </p>
            )}
            {pron.length > 1 && (
              <p className="mt-3 leading-relaxed">
                <strong className="font-bold">Aussprache:</strong>{" "}
                {pron.map((p, i) => (
                  <span key={p.position}>
                    {i > 0 && "; "}
                    <Ipa ipa={p.ipa} verified /> {p.label && <span className="text-ink-2">({p.label})</span>}
                  </span>
                ))}
              </p>
            )}
            {w.categories.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2" aria-label="Kategorien">
                {w.categories.map(({ category: c }) => (
                  <li key={c.slug}>
                    <Link href={`/woerter?kategorie=${c.slug}`} className={`chip ${bandClass(c.color)}`}>
                      <span className="size-2.5 rounded-full" style={{ background: "var(--band)" }} aria-hidden />
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {related.length > 0 && (
              <p className="mt-6 leading-relaxed">
                <strong className="font-bold">Ähnliche Wörter:</strong>{" "}
                {related.map((r, i) => (
                  <span key={r.slug}>
                    {i > 0 && ", "}
                    <Link href={`/wort/${r.slug}`} className="underline decoration-line hover:decoration-ink">
                      {r.term}
                    </Link>
                  </span>
                ))}
              </p>
            )}
            <p className="tabular mt-8 border-t border-line pt-3 text-sm text-ink-3">
              <span className="condensed font-black text-ink-2">{cardNo(w.cardNumber)}</span>
              {w.acceptedAt && (
                <>
                  {" · aufgenommen am "}
                  <time dateTime={w.acceptedAt.toISOString()}>{formatDate(w.acceptedAt)}</time>
                </>
              )}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <ShareButton small title={w.term} text={w.definitions[0]?.text ? `${w.term}: ${w.definitions[0].text}` : w.term} />
            <Link href="/zufall" className="btn btn-quiet btn-sm">
              <Shuffle size={18} aria-hidden /> Zufälliges Wort
            </Link>
            {can(viewer, "edit") && (
              <Link href={`/k/wort/${w.id}/bearbeiten`} className="btn btn-quiet btn-sm">
                <Pencil size={17} aria-hidden /> Bearbeiten
              </Link>
            )}
            {viewer && <FavoriteButton wordId={w.id} active={me?.favoriteWordId === w.id} />}
            {viewer && !openRound && <ChallengeButton wordId={w.id} term={w.term} />}
          </div>
          {viewer && (fans.length > 0 || openRound) && (
            <p className="mt-4 text-sm text-ink-2">
              {fans.length > 0 && <>Lieblingswort von {fans.map((f, i) => <span key={f.id}>{i > 0 && ", "}<Link href={`/profil/${f.id}`} className="font-semibold underline decoration-line hover:decoration-ink">{f.name}</Link></span>)}. </>}
              {openRound && "Wird gerade neu bewertet."}
            </p>
          )}
        </article>

        <aside className="hidden md:sticky md:top-24 md:block md:self-start" aria-label="Karte">
          {/* Index card only: the text itself is set in the entry. */}
          <WordCard compact data={{ ...toCard(w), definition: null, example: null }} headingLevel={2}>
            <></>
          </WordCard>
        </aside>
      </div>
    </div>
  );
}
