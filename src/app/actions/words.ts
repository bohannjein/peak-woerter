"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCurator, requireStaff } from "@/lib/access";
import { castVote, openRound, retractVote } from "@/lib/voting";
import { addComment, saveEntry, submitWord } from "@/lib/words";
import { AppError, safeAction } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/text";
import { BAND_COLORS } from "@/lib/categories";

const Id = z.string().min(1).max(64);

function refresh() {
  revalidatePath("/", "layout");
}

export async function castVoteAction(wordId: string, value: "YES" | "NO" | "LATER") {
  return safeAction(async () => {
    const v = await requireCurator();
    const r = await castVote(db, { wordId: Id.parse(wordId), userId: v.id, value: z.enum(["YES", "NO", "LATER"]).parse(value) });
    refresh();
    return r;
  });
}

export async function retractVoteAction(wordId: string) {
  return safeAction(async () => {
    const v = await requireCurator();
    await retractVote(db, { wordId: Id.parse(wordId), userId: v.id });
    refresh();
    return true;
  });
}

const Submit = z.object({
  term: z.string().trim().min(1, "Bitte ein Wort eingeben.").max(120, "Das ist zu lang für ein Wort (max. 120 Zeichen)."),
  note: z.string().trim().max(1000).optional(),
  voteYes: z.boolean(),
});

export async function submitWordAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireCurator();
    const r = Submit.safeParse({ term: fd.get("term"), note: fd.get("note") || undefined, voteYes: fd.get("voteYes") === "on" });
    if (!r.success) throw new AppError(r.error.issues[0].message);
    const w = await submitWord(db, { ...r.data, userId: v.id });
    refresh();
    return { term: w.term, id: w.id };
  });
}

export async function openRoundAction(wordId: string, kind: "REVOTE" | "REVIEW", reason?: string) {
  return safeAction(async () => {
    const v = await requireStaff();
    await openRound(db, { wordId: Id.parse(wordId), userId: v.id, kind: z.enum(["REVOTE", "REVIEW"]).parse(kind), reason: reason?.slice(0, 500) });
    refresh();
    return true;
  });
}

export async function commentAction(wordId: string, _: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireCurator();
    await addComment(db, { wordId: Id.parse(wordId), userId: v.id, body: String(fd.get("body") ?? "") });
    revalidatePath(`/k/wort/${wordId}`);
    revalidatePath("/k/spaeter");
    return true;
  });
}

const Entry = z.object({
  term: z.string().trim().min(1).max(120),
  partOfSpeech: z.enum(["SUBSTANTIV", "VERB", "ADJEKTIV", "ADVERB", "INTERJEKTION", "REDEWENDUNG", "SONSTIGES"]).nullable(),
  grammar: z.string().max(200).nullable(),
  usage: z.string().max(2000).nullable(),
  origin: z.string().max(2000).nullable(),
  variants: z.array(z.string().max(120)).max(20),
  definitions: z.array(z.object({ text: z.string().max(600), detail: z.string().max(2000).nullable() })).max(12),
  pronunciations: z.array(z.object({ ipa: z.string().max(120), label: z.string().max(80).nullable(), verified: z.boolean() })).max(8),
  examples: z.array(z.string().max(600)).max(10),
  categoryIds: z.array(Id).max(20),
  meaningChanged: z.boolean(),
});

export async function saveEntryAction(wordId: string, input: unknown) {
  return safeAction(async () => {
    const v = await requireCurator();
    const r = Entry.safeParse(input);
    if (!r.success) throw new AppError("Ungültige oder zu lange Angaben.");
    const out = await saveEntry(db, Id.parse(wordId), v.id, r.data);
    refresh();
    return out;
  });
}

// ───────── Categories ─────────

const Cat = z.object({ name: z.string().trim().min(1, "Name fehlt.").max(40), color: z.enum(BAND_COLORS) });

export async function saveCategoryAction(id: string | null, _: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireStaff();
    const r = Cat.safeParse({ name: fd.get("name"), color: fd.get("color") });
    if (!r.success) throw new AppError(r.error.issues[0].message);
    const data = { name: r.data.name, color: r.data.color, slug: slugify(r.data.name) };
    const clash = await db.category.findFirst({ where: { OR: [{ name: data.name }, { slug: data.slug }], NOT: id ? { id } : undefined } });
    if (clash) throw new AppError("Eine Kategorie mit diesem Namen gibt es schon.");
    if (id) await db.category.update({ where: { id }, data });
    else await db.category.create({ data });
    await audit(db, v.id, id ? "category.updated" : "category.created", "category", id, data);
    refresh();
    return true;
  });
}

export async function deleteCategoryAction(id: string) {
  return safeAction(async () => {
    const v = await requireStaff();
    await db.category.delete({ where: { id: Id.parse(id) } });
    await audit(db, v.id, "category.deleted", "category", id);
    refresh();
    return true;
  });
}

/** Moves all words from `fromId` into `intoId`, then removes `fromId`. */
export async function mergeCategoryAction(fromId: string, intoId: string) {
  return safeAction(async () => {
    const v = await requireStaff();
    if (fromId === intoId) throw new AppError("Bitte zwei verschiedene Kategorien wählen.");
    await db.$transaction(async (tx) => {
      const links = await tx.wordCategory.findMany({ where: { categoryId: fromId } });
      await tx.wordCategory.createMany({ data: links.map((l) => ({ wordId: l.wordId, categoryId: intoId })), skipDuplicates: true });
      await tx.category.delete({ where: { id: fromId } });
      await audit(tx, v.id, "category.merged", "category", intoId, { from: fromId, words: links.length });
    });
    refresh();
    return true;
  });
}
