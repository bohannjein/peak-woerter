import type { Db, Tx } from "./db";
import { AppError } from "./errors";
import { audit } from "./audit";
import { cleanIpa, cleanTerm, normalizeTerm, slugify } from "./text";
import { castVote, openInitialRound, openRound } from "./voting";
import type { PartOfSpeech, WordStatus } from "@/generated/prisma/enums";

export type DuplicateInfo = { kind: "none" } | { kind: "word"; status: WordStatus; slug: string; term: string; id: string };

export async function findDuplicate(db: Db | Tx, term: string): Promise<DuplicateInfo> {
  const normalized = normalizeTerm(term);
  const word = await db.word.findUnique({ where: { normalized }, select: { id: true, status: true, slug: true, term: true } });
  return word ? { kind: "word", ...word } : { kind: "none" };
}

/** Message for curators. They may know about the negative list. */
export function duplicateMessageForCurator(d: DuplicateInfo): string | null {
  if (d.kind !== "word") return null;
  return {
    ACCEPTED: `„${d.term}“ ist schon in der Sammlung.`,
    VOTING: `„${d.term}“ steht schon zur Abstimmung.`,
    LATER: `„${d.term}“ liegt auf der Später-Liste.`,
    REJECTED: `„${d.term}“ steht auf der Negativliste.`,
  }[d.status];
}

async function uniqueSlug(tx: Tx, term: string, ignoreId?: string) {
  const base = slugify(term);
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const hit = await tx.word.findUnique({ where: { slug }, select: { id: true } });
    if (!hit || hit.id === ignoreId) return slug;
  }
}

export async function submitWord(
  db: Db,
  input: { term: string; note?: string | null; userId: string; voteYes?: boolean },
) {
  const term = cleanTerm(input.term);
  if (!term) throw new AppError("Bitte ein Wort eingeben.");
  const seat = await db.curatorSeat.findUnique({ where: { userId: input.userId } });
  if (!seat) throw new AppError("Nur für Kuratoren.", 403);

  const word = await db.$transaction(async (tx) => {
    const dup = await findDuplicate(tx, term);
    if (dup.kind === "word") throw new AppError(duplicateMessageForCurator(dup)!, 409);
    const w = await tx.word.create({
      data: {
        term,
        normalized: normalizeTerm(term),
        slug: await uniqueSlug(tx, term),
        submissionNote: input.note?.trim() || null,
        submittedById: input.userId,
        source: "CURATOR",
      },
    });
    await openInitialRound(tx, w.id, input.userId);
    await audit(tx, input.userId, "word.submitted", "word", w.id, { term });
    return w;
  });
  if (input.voteYes) await castVote(db, { wordId: word.id, userId: input.userId, value: "YES" });
  return word;
}

// ───────────────────────── Editorial ─────────────────────────

export type EntryInput = {
  term: string;
  partOfSpeech: PartOfSpeech | null;
  grammar: string | null;
  usage: string | null;
  origin: string | null;
  variants: string[];
  definitions: { text: string; detail: string | null }[];
  pronunciations: { ipa: string; label: string | null; verified: boolean }[];
  examples: string[];
  categoryIds: string[];
  /** Curator states the core meaning changed substantially. */
  meaningChanged: boolean;
};

/**
 * Saves a dictionary entry. Editorial corrections never touch voting.
 * Changing the term itself, or flagging a substantial change of meaning, on an
 * accepted word starts a re-evaluation round.
 */
export async function saveEntry(db: Db, wordId: string, userId: string, input: EntryInput) {
  const term = cleanTerm(input.term);
  if (!term) throw new AppError("Der Begriff darf nicht leer sein.");
  const normalized = normalizeTerm(term);

  const { essential, status } = await db.$transaction(async (tx) => {
    const word = await tx.word.findUnique({ where: { id: wordId } });
    if (!word) throw new AppError("Wort nicht gefunden.", 404);
    const termChanged = normalized !== word.normalized;
    if (termChanged) {
      const dup = await tx.word.findUnique({ where: { normalized }, select: { id: true } });
      if (dup) throw new AppError("Begriff existiert schon.", 409);
    }
    const clean = (s: string | null) => s?.trim() || null;
    await tx.word.update({
      where: { id: wordId },
      data: {
        term,
        normalized,
        slug: termChanged ? await uniqueSlug(tx, term, wordId) : undefined,
        partOfSpeech: input.partOfSpeech,
        grammar: clean(input.grammar),
        usage: clean(input.usage),
        origin: clean(input.origin),
        variants: input.variants.map((v) => cleanTerm(v)).filter(Boolean),
      },
    });
    await tx.definition.deleteMany({ where: { wordId } });
    await tx.definition.createMany({
      data: input.definitions.filter((d) => d.text.trim()).map((d, i) => ({ wordId, position: i + 1, text: d.text.trim(), detail: clean(d.detail) })),
    });
    // Keep audio of pronunciations whose IPA did not change.
    const oldPron = await tx.pronunciation.findMany({ where: { wordId } });
    await tx.pronunciation.deleteMany({ where: { wordId } });
    await tx.pronunciation.createMany({
      data: input.pronunciations
        .map((p) => ({ ...p, ipa: cleanIpa(p.ipa) }))
        .filter((p) => p.ipa)
        .map((p, i) => ({
          wordId,
          position: i + 1,
          ipa: p.ipa,
          label: clean(p.label),
          verified: p.verified,
          audioPath: oldPron.find((o) => o.ipa === p.ipa)?.audioPath ?? null,
        })),
    });
    await tx.example.deleteMany({ where: { wordId } });
    await tx.example.createMany({ data: input.examples.map((t) => t.trim()).filter(Boolean).map((text, i) => ({ wordId, position: i + 1, text })) });
    await tx.wordCategory.deleteMany({ where: { wordId } });
    await tx.wordCategory.createMany({ data: [...new Set(input.categoryIds)].map((categoryId) => ({ wordId, categoryId })) });

    const essential = termChanged || input.meaningChanged;
    await audit(tx, userId, essential ? "entry.essential_change" : "entry.edited", "word", wordId, {
      termBefore: termChanged ? word.term : undefined,
      term: termChanged ? term : undefined,
      meaningChanged: input.meaningChanged || undefined,
    });
    return { essential, status: word.status };
  });

  if (essential && status === "ACCEPTED") {
    const open = await db.votingRound.findFirst({ where: { wordId, closedAt: null } });
    if (!open) await openRound(db, { wordId, userId, kind: "REVIEW", reason: "Wesentliche Änderung am Eintrag" });
  }
  return { essential };
}

export async function addComment(db: Db, input: { wordId: string; userId: string; body: string }) {
  const body = input.body.trim();
  if (!body) throw new AppError("Kommentar ist leer.");
  if (body.length > 2000) throw new AppError("Kommentar ist zu lang (max. 2000 Zeichen).");
  const round = await db.votingRound.findFirst({ where: { wordId: input.wordId }, orderBy: { number: "desc" } });
  return db.comment.create({ data: { wordId: input.wordId, userId: input.userId, body, roundId: round?.id } });
}
