import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { toCard } from "@/lib/cards";
import { formatDate } from "@/lib/time";
import { SwipeDeck, type DeckItem } from "./SwipeDeck";

export const metadata: Metadata = { title: "Abstimmen", robots: { index: false } };
export const dynamic = "force-dynamic";

const KIND_LABEL = { INITIAL: "Neu", REVOTE: "Neue Runde", REVIEW: "Neubewertung" } as const;

export default async function Abstimmen() {
  const v = await requireStaffPage();
  if (!v.seat) redirect("/admin");

  const rounds = await db.votingRound.findMany({
    where: { closedAt: null, votes: { none: { seat: v.seat } } },
    orderBy: { openedAt: "asc" },
    include: {
      word: {
        include: {
          definitions: { orderBy: { position: "asc" } },
          pronunciations: { orderBy: { position: "asc" } },
          examples: { orderBy: { position: "asc" } },
          categories: { include: { category: true } },
          submittedBy: { select: { name: true } },
        },
      },
    },
  });

  const items: DeckItem[] = rounds.map((r) => {
    const w = r.word;
    const card = toCard({ ...w, acceptedAt: null }, { showUnverified: true, bandLabel: KIND_LABEL[r.kind] });
    card.cardNumber = w.cardNumber;
    card.values = [
      ...(card.values ?? []).filter(([k]) => k === "Buchstaben" || k === "Bedeutungen"),
      ["Runde", r.number],
      ["Eingereicht", formatDate(w.createdAt, { day: "numeric", month: "short" })],
    ];
    if (r.kind === "REVIEW") card.band = null;
    const by = w.submittedBy?.name ?? (w.guestName ? `${w.guestName} (Gast)` : w.source === "GUEST" ? "Gast" : null);
    return {
      wordId: w.id,
      term: w.term,
      card,
      note: w.submissionNote && !card.definition ? { by, text: w.submissionNote } : null,
      by,
    };
  });

  return <SwipeDeck initial={items} />;
}
