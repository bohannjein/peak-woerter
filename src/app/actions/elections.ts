"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getGuest, getViewer, requireAdmin } from "@/lib/access";
import { castElectionVote, retractElectionVote, validateDates, type Voter } from "@/lib/elections";
import { fromBerlinLocal } from "@/lib/time";
import { audit } from "@/lib/audit";
import { AppError, safeAction } from "@/lib/errors";

const Id = z.string().min(1).max(64);

/** Accounts vote as themselves, guests as their guest session. */
async function voter(): Promise<Voter> {
  const v = await getViewer();
  if (v) {
    if (v.missing.length) throw new AppError("Zuerst Pflicht-Sicherheit einrichten.", 403);
    return { userId: v.id };
  }
  const g = await getGuest();
  if (g) return { guestId: g.id };
  throw new AppError("Bitte melde dich an.", 401);
}

export async function electionVoteAction(electionId: string, wordId: string, value: 1 | -1) {
  return safeAction(async () => {
    await castElectionVote(db, { electionId: Id.parse(electionId), voter: await voter(), wordId: Id.parse(wordId), value: value === -1 ? -1 : 1 });
    revalidatePath("/wort-des-jahres");
    return true;
  });
}

export async function retractElectionVoteAction(electionId: string, wordId: string) {
  return safeAction(async () => {
    await retractElectionVote(db, { electionId: Id.parse(electionId), voter: await voter(), wordId: Id.parse(wordId) });
    revalidatePath("/wort-des-jahres");
    return true;
  });
}

const Local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Bitte alle Termine angeben.");
const Election = z.object({
  kind: z.enum(["JURY", "COMMUNITY"]),
  year: z.coerce.number().int().min(2000).max(2100),
  nominateFrom: Local,
  shortlistFrom: Local,
  finalFrom: Local,
  endsAt: Local,
  nominations: z.coerce.number().int().min(1).max(20),
  shortlistVotes: z.coerce.number().int().min(1).max(20),
  finalists: z.coerce.number().int().min(2).max(20),
});

export async function saveElectionAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireAdmin();
    const r = Election.safeParse(Object.fromEntries(fd));
    if (!r.success) throw new AppError(r.error.issues[0].message);
    const { kind, year, ...rest } = r.data;
    const data = {
      ...rest,
      nominateFrom: fromBerlinLocal(rest.nominateFrom),
      shortlistFrom: fromBerlinLocal(rest.shortlistFrom),
      finalFrom: fromBerlinLocal(rest.finalFrom),
      endsAt: fromBerlinLocal(rest.endsAt),
    };
    validateDates(data);
    const existing = await db.election.findUnique({ where: { kind_year: { kind, year } } });
    if (existing?.decidedAt) throw new AppError("Diese Wahl ist schon entschieden.");
    await db.election.upsert({ where: { kind_year: { kind, year } }, create: { kind, year, ...data }, update: data });
    await audit(db, v.id, "election.saved", "election", null, { kind, year });
    revalidatePath("/", "layout");
    return true;
  });
}

export async function deleteElectionAction(id: string) {
  return safeAction(async () => {
    const v = await requireAdmin();
    await db.election.delete({ where: { id: Id.parse(id) } });
    await audit(db, v.id, "election.deleted", "election", id);
    revalidatePath("/", "layout");
    return true;
  });
}
