import type { Db } from "./db";
import { berlinMonth } from "./time";

export type Wrapped = {
  year: number;
  submitted: number; // words entered into voting this year
  accepted: number; // first acceptances this year
  rejected: number;
  sentLater: number;
  disagreements: number; // decided rounds where the two votes differed
  topSubmitters: { name: string; count: number }[];
  busiestMonth: { month: number; count: number } | null; // by accepted words; null on a tie
  topCategories: { name: string; count: number }[];
  multiRoundWords: { term: string; slug: string | null; rounds: number }[];
  acceptedWords: { term: string; slug: string; acceptedAt: Date }[];
};

export type PublicWrapped = Pick<Wrapped, "year" | "accepted" | "busiestMonth" | "topCategories" | "acceptedWords">;

function berlinYearStart(year: number) {
  // Midnight Europe/Berlin on 1 January is always CET (+01:00).
  return new Date(`${year}-01-01T00:00:00+01:00`);
}

/** Every number derives from stored rounds, votes and words; nothing is estimated. */
export async function computeWrapped(db: Db, year: number): Promise<Wrapped> {
  const inYear = { gte: berlinYearStart(year), lt: berlinYearStart(year + 1) };

  const [submitted, rounds, words] = await Promise.all([
    db.word.count({ where: { createdAt: inYear } }),
    db.votingRound.findMany({
      where: { closedAt: inYear, outcome: { not: "CANCELLED" } },
      include: { votes: true, word: { select: { id: true, term: true, slug: true, isPublic: true } } },
    }),
    db.word.findMany({ where: { createdAt: inYear }, select: { submittedBy: { select: { name: true } } } }),
  ]);

  // First acceptance = an ACCEPTED round that is not a re-evaluation.
  const firstAccepts = rounds.filter((r) => r.outcome === "ACCEPTED" && r.kind !== "REVIEW");
  const acceptedIds = new Set(firstAccepts.map((r) => r.wordId));

  const byMonth = new Map<number, number>();
  for (const r of firstAccepts) {
    const m = berlinMonth(r.closedAt!);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  const months = [...byMonth.entries()].sort((a, b) => b[1] - a[1]);
  const busiestMonth = months.length && (months.length === 1 || months[0][1] > months[1][1]) ? { month: months[0][0], count: months[0][1] } : null;

  const subCount = new Map<string, number>();
  for (const w of words) if (w.submittedBy) subCount.set(w.submittedBy.name, (subCount.get(w.submittedBy.name) ?? 0) + 1);
  const topSubmitters = [...subCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  const cats = acceptedIds.size
    ? await db.wordCategory.groupBy({ by: ["categoryId"], where: { wordId: { in: [...acceptedIds] } }, _count: { _all: true } })
    : [];
  const catNames = await db.category.findMany({ where: { id: { in: cats.map((c) => c.categoryId) } } });
  const topCategories = cats
    .map((c) => ({ name: catNames.find((n) => n.id === c.categoryId)!.name, count: c._count._all }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"))
    .slice(0, 5);

  const touched = [...new Set(rounds.map((r) => r.wordId))];
  const roundsPerWord = touched.length
    ? await db.votingRound.groupBy({ by: ["wordId"], where: { wordId: { in: touched } }, _count: { _all: true } })
    : [];
  const multiRoundWords = roundsPerWord
    .filter((r) => r._count._all > 1)
    .map((r) => {
      const w = rounds.find((x) => x.wordId === r.wordId)!.word;
      return { term: w.term, slug: w.isPublic ? w.slug : null, rounds: r._count._all };
    })
    .sort((a, b) => b.rounds - a.rounds || a.term.localeCompare(b.term, "de"));

  const acceptedWords = (
    await db.word.findMany({ where: { id: { in: [...acceptedIds] }, isPublic: true }, select: { term: true, slug: true, acceptedAt: true } })
  )
    .map((w) => ({ term: w.term, slug: w.slug, acceptedAt: w.acceptedAt! }))
    .sort((a, b) => a.acceptedAt.getTime() - b.acceptedAt.getTime());

  return {
    year,
    submitted,
    accepted: acceptedIds.size,
    rejected: rounds.filter((r) => r.outcome === "REJECTED").length,
    sentLater: rounds.filter((r) => r.outcome === "LATER").length,
    disagreements: rounds.filter((r) => r.votes.length === 2 && r.votes[0].value !== r.votes[1].value).length,
    topSubmitters,
    busiestMonth,
    topCategories,
    multiRoundWords,
    acceptedWords,
  };
}

/** Public recap: only accepted words and aggregate, non-sensitive numbers. */
export function toPublic(w: Wrapped): PublicWrapped {
  return { year: w.year, accepted: w.accepted, busiestMonth: w.busiestMonth, topCategories: w.topCategories, acceptedWords: w.acceptedWords };
}
