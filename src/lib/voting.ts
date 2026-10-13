// Voting state machine. Every status change of a word goes through here,
// inside a transaction that locks the affected row.
//
//   VOTING ──(Ja+Ja)──────────▶ ACCEPTED (public)
//     │    ──(Nein+Nein)──────▶ REJECTED (negative list)
//     └────(sonst)────────────▶ LATER ──(neue Runde)──▶ VOTING
//   ACCEPTED ──(Neubewertung)─▶ ACCEPTED + open REVIEW round
//            (first Nein hides it until the round closes)
//   REJECTED ──(erneute Prüfung)──▶ VOTING
import type { Db, Tx } from "./db";
import { AppError } from "./errors";
import { audit } from "./audit";
import type { RoundKind, RoundOutcome, VoteValue } from "@/generated/prisma/enums";

export type Decision = Exclude<RoundOutcome, "CANCELLED">;

/** Pure decision table. Returns null while a vote is missing. */
export function decide(a: VoteValue | undefined, b: VoteValue | undefined): Decision | null {
  if (!a || !b) return null;
  if (a === "LATER" || b === "LATER") return "LATER";
  if (a === "YES" && b === "YES") return "ACCEPTED";
  if (a === "NO" && b === "NO") return "REJECTED";
  return "LATER";
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

    const votes = await tx.vote.findMany({ where: { roundId: round.id } });
    const bySeat = (s: number) => votes.find((v) => v.seat === s)?.value;
    const outcome = decide(bySeat(1), bySeat(2));

    if (!outcome) {
      // Re-evaluation: a single "Nein" hides the word until the round is decided.
      if (round.kind === "REVIEW" && input.value === "NO") {
        await tx.word.update({ where: { id: input.wordId }, data: { isPublic: false } });
      }
      return { outcome: null, roundId: round.id };
    }

    const now = new Date();
    await tx.votingRound.update({ where: { id: round.id }, data: { closedAt: now, outcome } });
    const word = await tx.word.findUniqueOrThrow({ where: { id: input.wordId }, select: { cardNumber: true, acceptedAt: true } });
    if (outcome === "ACCEPTED") {
      await tx.word.update({
        where: { id: input.wordId },
        data: {
          status: "ACCEPTED",
          isPublic: true,
          acceptedAt: word.acceptedAt ?? now,
          cardNumber: word.cardNumber ?? (await nextCardNumber(tx)),
        },
      });
    } else {
      await tx.word.update({ where: { id: input.wordId }, data: { status: outcome, isPublic: false } });
    }
    await audit(tx, null, "round.closed", "word", input.wordId, { roundId: round.id, outcome });
    return { outcome, roundId: round.id };
  });
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

/**
 * Opens a new round. Old rounds and votes stay untouched (history).
 * REVOTE: from the Später list or the negative list. REVIEW: re-evaluate an accepted word.
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
      data: { wordId: input.wordId, number: (last._max.number ?? 0) + 1, kind: input.kind, openedById: input.userId },
    });
    if (input.kind === "REVOTE") {
      await tx.word.update({ where: { id: input.wordId }, data: { status: "VOTING", isPublic: false } });
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
  return tx.votingRound.create({ data: { wordId, number: 1, kind: "INITIAL", openedById: userId } });
}
