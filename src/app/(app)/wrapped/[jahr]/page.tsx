import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { computeWrapped, toPublic } from "@/lib/wrapped";
import { Story, type Slide } from "./Story";

export const metadata: Metadata = { title: "Peake Wrapped" };
export const dynamic = "force-dynamic";

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const n = (x: number, one: string, many: string) => `${x} ${x === 1 ? one : many}`;

export default async function Wrapped({ params }: { params: Promise<{ jahr: string }> }) {
  const year = Number((await params).jahr);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();
  // The layout already requires login. Members without a vote see the
  // non-sensitive subset (no votes, no names).
  const viewer = await getViewer();
  const staff = !!viewer && (!!viewer.seat || viewer.isAdmin);

  const full = await computeWrapped(db, year);
  const w = staff ? full : { ...full, ...toPublic(full) };
  const slides: Slide[] = [{ tone: "ink", big: String(year), title: "Peake Wrapped" }];

  if (staff) {
    if (full.submitted)
      slides.push({ tone: "card", big: String(full.submitted), title: full.submitted === 1 ? "Wort eingereicht" : "Wörter eingereicht" });
  }
  slides.push(
    w.accepted
      ? { tone: "yes", big: String(w.accepted), title: w.accepted === 1 ? "Wort aufgenommen" : "Wörter aufgenommen" }
      : { tone: "card", title: "Keine neuen Wörter" },
  );
  if (staff) {
    if (full.rejected) slides.push({ tone: "no", big: String(full.rejected), title: "Mal beide Nein" });
    if (full.disagreements || full.sentLater)
      slides.push({
        tone: "later",
        big: String(full.disagreements),
        title: "Mal uneinig",
        text: full.sentLater ? `${n(full.sentLater, "Runde endete", "Runden endeten")} auf der Später-Liste.` : undefined,
      });
    if (full.topSubmitters.length) {
      const [a, b] = full.topSubmitters;
      slides.push(
        b && a.count === b.count
          ? { tone: "card", title: "Gleichstand beim Einreichen", text: `${a.name} und ${b.name} mit je ${n(a.count, "Wort", "Wörtern")}.` }
          : { tone: "card", big: a.name, title: "hat am meisten eingereicht", text: `${n(a.count, "Wort", "Wörter")}${b ? ` – ${b.name} kam auf ${b.count}.` : "."}` },
      );
    }
  }
  if (w.busiestMonth) slides.push({ tone: "ink", big: MONTHS[w.busiestMonth.month - 1], title: "war der stärkste Monat", text: `${n(w.busiestMonth.count, "neues Wort", "neue Wörter")} im Deck.` });
  if (w.topCategories.length) slides.push({ tone: "card", title: "Am häufigsten", list: w.topCategories.map((c) => `${c.name} · ${c.count}`) });
  if (staff && full.multiRoundWords.length)
    slides.push({ tone: "later", title: "Mehrfach abgestimmt", list: full.multiRoundWords.slice(0, 6).map((m) => `${m.term} · ${m.rounds} Runden`) });
  if (w.acceptedWords.length) slides.push({ tone: "ink", title: String(year), words: w.acceptedWords.map((a) => ({ term: a.term, slug: a.slug })) });

  return <Story slides={slides} />;
}
