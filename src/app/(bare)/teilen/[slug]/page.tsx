import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getGuest, getViewer } from "@/lib/access";
import { getPublicEntry } from "@/lib/queries";
import { toCard } from "@/lib/cards";
import { cardImageUrl, checkShareKey } from "@/lib/share";
import { WordCard } from "@/components/WordCard";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ k?: string }> };

export const dynamic = "force-dynamic";

async function load({ params, searchParams }: P) {
  const [{ slug }, { k }] = await Promise.all([params, searchParams]);
  if (!checkShareKey(slug, k)) return null;
  return getPublicEntry(db, slug);
}

export async function generateMetadata(p: P): Promise<Metadata> {
  const w = await load(p);
  if (!w) return { title: "Nicht gefunden" };
  const description = w.definitions[0]?.text ?? `${w.term} – aus der Sammlung von Peake Wörter.`;
  return {
    title: w.term,
    description,
    openGraph: { title: `${w.term} · Peake Wörter`, description, type: "article", images: [{ url: cardImageUrl(w.slug, true), width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image" },
  };
}

/** Public view of a shared word. Members and guests get the full word page instead. */
export default async function Geteilt(p: P) {
  const w = await load(p);
  if (!w) notFound();
  if ((await getViewer()) || (await getGuest())) redirect(`/wort/${w.slug}`);

  return (
    <div>
      <WordCard data={toCard(w)} headingLevel={1} />
      <p className="mt-8 text-center text-ink-2">Dieses Wort stammt aus der Sammlung von Peake Wörter.</p>
      <div className="mt-4 flex justify-center">
        <Link href="/anmelden" className="btn btn-quiet">
          Anmelden
        </Link>
      </div>
    </div>
  );
}
