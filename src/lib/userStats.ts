// Per-user statistics for the profile page. Like lib/wrapped.ts: every number
// derives from stored words, votes, comments and the audit log; nothing new is tracked.
import type { Db } from "./db";
import { gameWins } from "./games";
import { berlinDay } from "./time";

export const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"] as const;

const MATCH = { YES: "ACCEPTED", NO: "REJECTED", LATER: "LATER" } as const;
const AUDITED = ["entry.edited", "entry.essential_change", "ai.draft", "audio.uploaded"] as const;

type WordRef = { term: string; slug: string };

export type PublicStats = {
  submitted: number;
  accepted: number;
  /** Accepted share of decided submissions (accepted + rejected); null if none decided. */
  acceptRate: number | null;
  firstAccepted: WordRef | null;
  latestAccepted: WordRef | null;
  highestCard: number | null;
  topCategories: { name: string; count: number }[];
  comments: number;
  gameEntries: number;
  gameWins: number;
  yearWins: { year: number; kind: "JURY" | "COMMUNITY"; word: WordRef }[];
};

export type PrivateStats = {
  votes: { total: number; yes: number; no: number; later: number };
  /** Share of votes in decided rounds that matched the outcome; null if none decided. */
  hitRate: number | null;
  /** Median minutes from round opening to own vote; null without votes. */
  medianMinutesToVote: number | null;
  /** Open rounds still missing this user's vote; null for members without a seat. */
  openRounds: number | null;
  ownLater: number;
  ownRejected: number;
  roundsOpened: number;
  edits: number;
  aiDrafts: number;
  recordings: number;
  elections: number;
  gameVotes: number;
  activeDays: number;
  longestStreak: number;
  topWeekday: (typeof WEEKDAYS)[number] | null;
  /** Active days per month, oldest first, last 12 months including the current one. */
  months: { month: string; days: number }[];
  lastLogin: Date | null;
};

export type UserStats = { public: PublicStats; private: PrivateStats | null };

export async function computeUserStats(db: Db, userId: string, opts: { includePrivate: boolean }): Promise<UserStats> {
  const mine = { submittedById: userId };
  const [submitted, accepted, rejected, first, latest, card, cats, comments, gameEntries, wins, elections] = await Promise.all([
    db.word.count({ where: mine }),
    db.word.count({ where: { ...mine, status: "ACCEPTED" } }),
    db.word.count({ where: { ...mine, status: "REJECTED" } }),
    db.word.findFirst({ where: { ...mine, isPublic: true }, orderBy: { acceptedAt: "asc" }, select: { term: true, slug: true } }),
    db.word.findFirst({ where: { ...mine, isPublic: true }, orderBy: { acceptedAt: "desc" }, select: { term: true, slug: true } }),
    db.word.aggregate({ where: { ...mine, isPublic: true }, _max: { cardNumber: true } }),
    db.wordCategory.groupBy({ by: ["categoryId"], where: { word: { ...mine, isPublic: true } }, _count: { _all: true } }),
    db.comment.count({ where: { userId } }),
    db.gameEntry.count({ where: { userId } }),
    gameWins(db, userId),
    db.election.findMany({ where: { winner: { ...mine, isPublic: true } }, orderBy: { year: "desc" }, select: { year: true, kind: true, winner: { select: { term: true, slug: true } } } }),
  ]);
  const catNames = await db.category.findMany({ where: { id: { in: cats.map((c) => c.categoryId) } }, select: { id: true, name: true } });

  const pub: PublicStats = {
    submitted,
    accepted,
    acceptRate: accepted + rejected ? accepted / (accepted + rejected) : null,
    firstAccepted: first,
    latestAccepted: latest,
    highestCard: card._max.cardNumber,
    topCategories: cats
      .map((c) => ({ name: catNames.find((n) => n.id === c.categoryId)!.name, count: c._count._all }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "de"))
      .slice(0, 3),
    comments,
    gameEntries,
    gameWins: wins,
    yearWins: elections.map((e) => ({ year: e.year, kind: e.kind, word: e.winner! })),
  };
  return { public: pub, private: opts.includePrivate ? await privateStats(db, userId, rejected) : null };
}

async function privateStats(db: Db, userId: string, ownRejected: number): Promise<PrivateStats> {
  const [votes, seat, ownLater, roundsOpened, audited, elections, gameVotes, session, days] = await Promise.all([
    db.vote.findMany({ where: { userId }, select: { value: true, createdAt: true, round: { select: { openedAt: true, outcome: true } } } }),
    db.curatorSeat.findUnique({ where: { userId }, select: { seat: true } }),
    db.word.count({ where: { submittedById: userId, status: "LATER" } }),
    db.votingRound.count({ where: { openedById: userId, kind: { not: "INITIAL" } } }),
    db.auditLog.groupBy({ by: ["action"], where: { actorId: userId, action: { in: [...AUDITED] } }, _count: { _all: true } }),
    db.electionVote.findMany({ where: { userId }, distinct: ["electionId"], select: { electionId: true } }),
    db.gameVote.count({ where: { voterId: userId } }),
    db.session.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    // Distinct Berlin days with any own activity. Prisma stores timestamps as UTC without zone.
    db.$queryRaw<{ day: string }[]>`
      SELECT DISTINCT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS day FROM (
        SELECT "createdAt" FROM audit_log WHERE "actorId" = ${userId}
        UNION ALL SELECT "createdAt" FROM vote WHERE "userId" = ${userId}
        UNION ALL SELECT "createdAt" FROM comment WHERE "userId" = ${userId}
        UNION ALL SELECT "createdAt" FROM game_entry WHERE "userId" = ${userId}
      ) t ORDER BY day`,
  ]);
  const openRounds = seat ? await db.votingRound.count({ where: { closedAt: null, votes: { none: { userId } } } }) : null;

  const decided = votes.filter((v) => v.round.outcome && v.round.outcome !== "CANCELLED");
  const waits = votes.map((v) => (v.createdAt.getTime() - v.round.openedAt.getTime()) / 60_000).sort((a, b) => a - b);
  const count = (a: (typeof AUDITED)[number]) => audited.find((x) => x.action === a)?._count._all ?? 0;

  return {
    votes: {
      total: votes.length,
      yes: votes.filter((v) => v.value === "YES").length,
      no: votes.filter((v) => v.value === "NO").length,
      later: votes.filter((v) => v.value === "LATER").length,
    },
    hitRate: decided.length ? decided.filter((v) => MATCH[v.value] === v.round.outcome).length / decided.length : null,
    medianMinutesToVote: waits.length ? Math.round(waits[Math.floor(waits.length / 2)]) : null,
    openRounds,
    ownLater,
    ownRejected,
    roundsOpened,
    edits: count("entry.edited") + count("entry.essential_change"),
    aiDrafts: count("ai.draft"),
    recordings: count("audio.uploaded"),
    elections: elections.length,
    gameVotes,
    ...activity(days.map((d) => d.day)),
    lastLogin: session?.createdAt ?? null,
  };
}

const DAY = 86_400_000;
const utc = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** Streak, weekday and month histogram from sorted distinct "YYYY-MM-DD" days. */
export function activity(days: string[], today = berlinDay()) {
  let longestStreak = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && utc(d) - utc(days[i - 1]) === DAY ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  });

  const perWeekday = new Array(7).fill(0);
  for (const d of days) perWeekday[new Date(utc(d)).getUTCDay()]++;
  const best = Math.max(...perWeekday);

  const [y, m] = today.split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 12 + i, 1));
    const month = date.toISOString().slice(0, 7);
    return { month, days: days.filter((d) => d.startsWith(month)).length };
  });

  return { activeDays: days.length, longestStreak, topWeekday: best > 0 ? WEEKDAYS[perWeekday.indexOf(best)] : null, months };
}
