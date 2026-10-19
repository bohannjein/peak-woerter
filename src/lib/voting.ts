// Voting state machine. Every status change of a word goes through here,
// inside a transaction that locks the affected row.
//
//   VOTING ──(Ja-Mehrheit)───▶ ACCEPTED (public)
//     │    ──(Nein-Mehrheit)─▶ REJECTED (negative list)
//     └────(sonst)───────────▶ LATER ──(neue Runde)──▶ VOTING
//   ACCEPTED ──(Anfechtung)──▶ ACCEPTED + open REVIEW round
//            (first Nein hides it; it leaves only with 100 % Nein)
//   REJECTED ──(erneute Prüfung)──▶ VOTING
import type { Db, Tx } from "./db";
import { AppError } from "./errors";
import { audit } from "./audit";
import { getSettings, type Settings } from "./settings";
import { notify } from "./notifications";
import type { RoundKind, RoundOutcome, VoteValue } from "@/generated/prisma/enums";

export type Decision = Exclude<RoundOutcome, "CANCELLED">;
export type Rule = Settings["voteRule"];

/**
 * Pure decision table. `n` = number of voters. A missing vote counts as neither
 * Ja nor Nein. Returns null while votes are missing, unless `force` (deadline passed).
 *
 * - majority (always with 2 voters): > 50 % Ja = accepted, > 50 % Nein = rejected,
 *   otherwise Später. With two voters: Ja+Ja, Nein+Nein, anything else = Später.
 * - unanimous (from 3 voters): 100 % Ja = accepted, a Später vote or a missing
 *   vote = Später, otherwise rejected.
 * - review (challenged word): leaves the collection only with 100 % Nein.
 */
export function decide(votes: VoteValue[], opts: { n: number; rule?: Rule; review?: boolean; force?: boolean }): Decision | null {
  const n = Math.max(opts.n, votes.length);
  if (votes.length < n && !opts.force) return null;
  const yes = votes.filter((v) => v === "YES").length;
  const no = votes.filter((v) => v === "NO").length;
  if (opts.review) return no === n ? "REJECTED" : "ACCEPTED";
  if (opts.rule === "unanimous" && n >= 3) {
    if (yes === n) return "ACCEPTED";
    return votes.includes("LATER") || votes.length < n ? "LATER" : "REJECTED";
  }
  return yes * 2 > n ? "ACCEPTED" : no * 2 > n ? "REJECTED" : "LATER";
}

async function seatOf(tx: Tx, userId: string): Promise<number> {
  const seat = await tx.curatorSeat.findUnique({ where: { userId } });
  if (!seat) throw new AppError("Nur Kuratoren dürfen abstimmen.", 403);
  const user = await tx.user.findUnique({ where: { id: userId }, select: { disabled: true } });
  if (!user || user.disabled) throw new AppError("Konto ist deaktiviert.", 403);
  return seat.seat;
}

async function lockOpenRound(tx: Tx, wordId: string) {
  const rows = await tx.$queryRaw<{ id: string; kind: RoundKind }[]>`
    SELECT id, kind FROM voting_round WHERE "wordId" = ${wordId} AND "closedAt" IS NULL FOR UPDATE`;
  return rows[0] ?? null;
}

async function lockWord(tx: Tx, wordId: string) {
  const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT id, status FROM word WHERE id = ${wordId} FOR UPDATE`;
  if (!rows[0]) throw new AppError("Wort nicht gefunden.", 404);
  return rows[0];
}

async function nextCardNumber(tx: Tx): Promise<number> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(424242)`;
  const r = await tx.word.aggregate({ _max: { cardNumber: true } });
  return (r._max.cardNumber ?? 0) + 1;
}

/** Applies a decision to the round and the word. */
async function closeRound(tx: Tx, wordId: string, round: { id: string; kind: RoundKind }, outcome: Decision) {
  const now = new Date();
  await tx.votingRound.update({ where: { id: round.id }, data: { closedAt: now, outcome } });
  const word = await tx.word.findUniqueOrThrow({ where: { id: wordId }, select: { term: true, cardNumber: true, acceptedAt: true, submittedById: true } });
  if (outcome === "ACCEPTED") {
    await tx.word.update({
      where: { id: wordId },
      data: { status: "ACCEPTED", isPublic: true, acceptedAt: word.acceptedAt ?? now, cardNumber: word.cardNumber ?? (await nextCardNumber(tx)) },
    });
  } else {
    await tx.word.update({ where: { id: wordId }, data: { status: outcome, isPublic: false } });
  }
  if (outcome === "LATER") {
    // Submitter and everyone who said Ja get a nudge to add context.
    const yes = await tx.vote.findMany({ where: { roundId: round.id, value: "YES" }, select: { userId: true } });
    const to = [word.submittedById, ...yes.map((v) => v.userId)].filter((x): x is string => !!x);
    await notify(tx, to, { wordId, body: `„${word.term}“ liegt jetzt auf der Später-Liste. Magst du Kontext ergänzen?`, href: `/k/wort/${wordId}` });
  }
  await audit(tx, null, "round.closed", "word", wordId, { roundId: round.id, outcome });
}

export type VoteResult = { outcome: Decision | null; roundId: string };

export async function castVote(db: Db, input: { wordId: string; userId: string; value: VoteValue }): Promise<VoteResult> {
  return db.$transaction(async (tx) => {
    const seat = await seatOf(tx, input.userId);
    await lockWord(tx, input.wordId);
    const round = await lockOpenRound(tx, input.wordId);
    if (!round) throw new AppError("Keine laufende Abstimmung.", 409);

    const existing = await tx.vote.findFirst({ where: { roundId: round.id, OR: [{ seat }, { userId: input.userId }] } });
    if (existing) throw new AppError("Du hast in dieser Runde schon abgestimmt.", 409);

    await tx.vote.create({ data: { roundId: round.id, userId: input.userId, seat, value: input.value } });
    await audit(tx, input.userId, "vote.cast", "word", input.wordId, { roundId: round.id, value: input.value });

    const s = await getSettings(tx);
    const votes = await tx.vote.findMany({ where: { roundId: round.id } });
    const outcome = decide(
      votes.map((v) => v.value),
      { n: s.voterCount, rule: s.voteRule, review: round.kind === "REVIEW" },
    );

    if (!outcome) {
      // Challenge: a single "Nein" hides the word until the round is decided.
      if (round.kind === "REVIEW" && input.value === "NO") {
        await tx.word.update({ where: { id: input.wordId }, data: { isPublic: false } });
      }
      return { outcome: null, roundId: round.id };
    }
    await closeRound(tx, input.wordId, round, outcome);
    return { outcome, roundId: round.id };
  });
}

/**
 * Decides open rounds that are due: deadline passed (with the votes cast so far)
 * or enough votes after the voter count was lowered. Cheap; called on page loads.
 */
export async function settleRounds(db: Db) {
  const s = await getSettings(db);
  const now = new Date();
  const open = await db.votingRound.findMany({
    where: { closedAt: null },
    select: { id: true, wordId: true, deadline: true, _count: { select: { votes: true } } },
  });
  const expired = (d: Date | null) => !!d && d < now;
  for (const r of open.filter((r) => expired(r.deadline) || r._count.votes >= s.voterCount)) {
    await db.$transaction(async (tx) => {
      await lockWord(tx, r.wordId);
      const round = await lockOpenRound(tx, r.wordId);
      if (round?.id !== r.id) return; // closed concurrently
      const votes = await tx.vote.findMany({ where: { roundId: r.id } });
      const outcome = decide(
        votes.map((v) => v.value),
        { n: s.voterCount, rule: s.voteRule, review: round.kind === "REVIEW", force: expired(r.deadline) },
      );
      if (outcome) await closeRound(tx, r.wordId, round, outcome);
    });
  }
}

/** Undo: take back the own vote while the round is still open. */
export async function retractVote(db: Db, input: { wordId: string; userId: string }) {
  return db.$transaction(async (tx) => {
    const seat = await seatOf(tx, input.userId);
    await lockWord(tx, input.wordId);
    const round = await lockOpenRound(tx, input.wordId);
    if (!round) throw new AppError("Runde schon entschieden.", 409);
    const del = await tx.vote.deleteMany({ where: { roundId: round.id, seat } });
    if (del.count === 0) throw new AppError("Keine Stimme zum Zurücknehmen.", 409);
    if (round.kind === "REVIEW") {
      const vetoes = await tx.vote.count({ where: { roundId: round.id, value: "NO" } });
      if (vetoes === 0) await tx.word.update({ where: { id: input.wordId }, data: { isPublic: true } });
    }
    await audit(tx, input.userId, "vote.retracted", "word", input.wordId, { roundId: round.id });
  });
}

const allowedFrom: Record<Exclude<RoundKind, "INITIAL">, string[]> = {
  REVOTE: ["LATER", "REJECTED"],
  REVIEW: ["ACCEPTED"],
};

async function deadline(tx: Tx) {
  const h = (await getSettings(tx)).voteDeadlineHours;
  return h > 0 ? new Date(Date.now() + h * 3600_000) : null;
}

/**
 * Opens a new round. Old rounds and votes stay untouched (history).
 * REVOTE: from the Später list or the negative list. REVIEW: challenge an accepted word.
 */
export async function openRound(db: Db, input: { wordId: string; userId: string; kind: Exclude<RoundKind, "INITIAL">; reason?: string }) {
  return db.$transaction(async (tx) => {
    const word = await lockWord(tx, input.wordId);
    if (!allowedFrom[input.kind].includes(word.status)) {
      throw new AppError("Hier ist keine neue Runde möglich.", 409);
    }
    if (await lockOpenRound(tx, input.wordId)) throw new AppError("Es läuft bereits eine Abstimmung.", 409);
    const last = await tx.votingRound.aggregate({ where: { wordId: input.wordId }, _max: { number: true } });
    const round = await tx.votingRound.create({
      data: { wordId: input.wordId, number: (last._max.number ?? 0) + 1, kind: input.kind, openedById: input.userId, deadline: await deadline(tx) },
    });
    if (input.kind === "REVOTE") {
      await tx.word.update({ where: { id: input.wordId }, data: { status: "VOTING", isPublic: false } });
    }
    if (input.reason && input.kind === "REVIEW") {
      await tx.comment.create({ data: { wordId: input.wordId, roundId: round.id, userId: input.userId, body: input.reason } });
    }
    await audit(tx, input.userId, input.kind === "REVIEW" ? "round.review" : "round.revote", "word", input.wordId, {
      roundId: round.id,
      from: word.status,
      reason: input.reason,
    });
    return round;
  });
}

/** Creates the first round for a freshly created word (inside the caller's transaction). */
export async function openInitialRound(tx: Tx, wordId: string, userId: string | null) {
  return tx.votingRound.create({ data: { wordId, number: 1, kind: "INITIAL", openedById: userId, deadline: await deadline(tx) } });
}
