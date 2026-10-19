// Wort des Jahres. Three stages, all dates set by the admin:
//   1 Nominieren   every voter picks up to `nominations` words from the collection
//   2 Vorauswahl   all nominated words; up to `shortlistVotes` up- and downvotes each
//   3 Finale       the `finalists` best of stage 2; one upvote and one downvote each
// Highest final score wins and is stored on the election (winnerWordId).
// JURY: accounts vote. COMMUNITY: accounts and guests (each guest browser = one voter).
import type { Db } from "./db";
import { AppError } from "./errors";
import type { ElectionKind } from "@/generated/prisma/enums";

export type Voter = { userId: string; guestId?: never } | { guestId: string; userId?: never };
export type Stage = 0 | 1 | 2 | 3 | 4; // 0 = not started, 4 = over

type Dates = { nominateFrom: Date; shortlistFrom: Date; finalFrom: Date; endsAt: Date };

export function stageOf(e: Dates, now = new Date()): Stage {
  if (now < e.nominateFrom) return 0;
  if (now < e.shortlistFrom) return 1;
  if (now < e.finalFrom) return 2;
  if (now < e.endsAt) return 3;
  return 4;
}

export const STAGE_LABEL: Record<Stage, string> = { 0: "Startet bald", 1: "Runde 1: Nominieren", 2: "Runde 2: Vorauswahl", 3: "Runde 3: Finale", 4: "Entschieden" };
export const KIND_LABEL: Record<ElectionKind, string> = { JURY: "Wort des Jahres", COMMUNITY: "Community-Wort des Jahres" };

export function validateDates(d: Dates) {
  if (!(d.nominateFrom < d.shortlistFrom && d.shortlistFrom < d.finalFrom && d.finalFrom < d.endsAt)) {
    throw new AppError("Die Termine müssen aufeinander folgen: Nominieren < Vorauswahl < Finale < Ende.");
  }
}

/** Sum of values per word in one stage. */
async function scores(db: Db, electionId: string, stage: number) {
  const rows = await db.electionVote.groupBy({ by: ["wordId"], where: { electionId, stage }, _sum: { value: true }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.wordId, { score: r._sum.value ?? 0, votes: r._count._all }]));
}

/** Words that are on the ballot in a stage. Stage 1: the whole collection (searched in the UI). */
export async function ballot(db: Db, e: { id: string; finalists: number }, stage: Stage) {
  if (stage <= 1) return null;
  const nominated = await scores(db, e.id, 1);
  if (stage === 2) return [...nominated.keys()];
  // Finalists: best stage-2 score; ties broken by nominations, then alphabetically (in the caller's word list).
  const s2 = await scores(db, e.id, 2);
  const words = await db.word.findMany({ where: { id: { in: [...nominated.keys()] }, isPublic: true }, select: { id: true, normalized: true } });
  return words
    .sort(
      (a, b) =>
        (s2.get(b.id)?.score ?? 0) - (s2.get(a.id)?.score ?? 0) ||
        (nominated.get(b.id)?.votes ?? 0) - (nominated.get(a.id)?.votes ?? 0) ||
        a.normalized.localeCompare(b.normalized),
    )
    .slice(0, e.finalists)
    .map((w) => w.id);
}

const voterWhere = (v: Voter) => (v.userId ? { userId: v.userId } : { guestId: v.guestId });

export async function castElectionVote(db: Db, input: { electionId: string; voter: Voter; wordId: string; value: 1 | -1 }) {
  const e = await db.election.findUnique({ where: { id: input.electionId } });
  if (!e) throw new AppError("Abstimmung nicht gefunden.", 404);
  if (input.voter.guestId && e.kind !== "COMMUNITY") throw new AppError("Hier stimmen nur Mitglieder ab.", 403);
  const stage = stageOf(e);
  if (stage < 1 || stage > 3) throw new AppError("Gerade läuft keine Runde.", 409);
  if (stage === 1 && input.value !== 1) throw new AppError("In Runde 1 wird nur nominiert.");
  if (!(await db.word.findFirst({ where: { id: input.wordId, isPublic: true }, select: { id: true } }))) throw new AppError("Wort nicht gefunden.", 404);
  const onBallot = await ballot(db, e, stage);
  if (onBallot && !onBallot.includes(input.wordId)) throw new AppError("Dieses Wort steht nicht zur Wahl.", 409);

  const mine = await db.electionVote.findMany({ where: { electionId: e.id, stage, ...voterWhere(input.voter) } });
  if (mine.some((m) => m.wordId === input.wordId)) throw new AppError("Für dieses Wort hast du in dieser Runde schon gestimmt.", 409);
  const limit = stage === 1 ? e.nominations : stage === 2 ? e.shortlistVotes : 1;
  if (mine.filter((m) => m.value === input.value).length >= limit) {
    throw new AppError(stage === 1 ? `Du hast schon ${limit} Wörter nominiert.` : `Keine ${input.value > 0 ? "Up" : "Down"}votes mehr übrig.`, 409);
  }
  return db.electionVote.create({ data: { electionId: e.id, stage, wordId: input.wordId, value: input.value, ...voterWhere(input.voter) } });
}

/** Take back an own vote while its stage is still running. */
export async function retractElectionVote(db: Db, input: { electionId: string; voter: Voter; wordId: string }) {
  const e = await db.election.findUnique({ where: { id: input.electionId } });
  if (!e) throw new AppError("Abstimmung nicht gefunden.", 404);
  const stage = stageOf(e);
  const del = await db.electionVote.deleteMany({ where: { electionId: e.id, stage, wordId: input.wordId, ...voterWhere(input.voter) } });
  if (!del.count) throw new AppError("Keine Stimme zum Zurücknehmen.", 409);
}

/** Stores the winner once the final is over. Idempotent; called lazily on page loads. */
export async function decideElection(db: Db, electionId: string) {
  const e = await db.election.findUnique({ where: { id: electionId } });
  if (!e || e.decidedAt || stageOf(e) < 4) return e;
  const finalists = (await ballot(db, e, 3)) ?? [];
  const s3 = await scores(db, e.id, 3);
  // ballot() is already ordered by stage-2 result, so a final tie goes to the better semi-final.
  const winner = [...finalists].sort((a, b) => (s3.get(b)?.score ?? 0) - (s3.get(a)?.score ?? 0))[0] ?? null;
  await db.election.updateMany({ where: { id: e.id, decidedAt: null }, data: { winnerWordId: winner, decidedAt: new Date() } });
  return db.election.findUnique({ where: { id: e.id } });
}

/** Current scores for display (stage 2 and 3 are shown live). */
export async function standings(db: Db, electionId: string, stage: number) {
  return scores(db, electionId, stage);
}
