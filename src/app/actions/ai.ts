"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { getAiKey, getAiProvider } from "@/lib/ai";
import { AppError, safeAction } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { POS_LABEL } from "@/lib/categories";
import type { Prisma } from "@/generated/prisma/client";

const ENTRY = {
  definitions: { orderBy: { position: "asc" } },
  examples: { orderBy: { position: "asc" } },
  pronunciations: { orderBy: { position: "asc" } },
  categories: { include: { category: { select: { name: true } } } },
} as const satisfies Prisma.WordInclude;

/** The saved entry as plain text for the prompt; null when nothing is filled in yet. */
function entryText(w: Prisma.WordGetPayload<{ include: typeof ENTRY }>) {
  const lines = [
    w.partOfSpeech && `Wortart: ${POS_LABEL[w.partOfSpeech]}`,
    ...w.definitions.map((d, i) => `Bedeutung ${i + 1}: ${d.text}${d.detail ? ` (${d.detail})` : ""}`),
    ...w.pronunciations.map((p) => `Lautschrift: ${p.ipa}${p.verified ? " (bestätigt)" : ""}`),
    ...w.examples.map((e) => `Beispiel: ${e.text}`),
    w.usage && `Verwendung: ${w.usage}`,
    w.origin && `Herkunft: ${w.origin}`,
    w.variants.length > 0 && `Schreibweisen: ${w.variants.join(", ")}`,
    w.categories.length > 0 && `Kategorien: ${w.categories.map((c) => c.category.name).join(", ")}`,
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

export async function requestAiDraftAction(wordId: string) {
  return safeAction(async () => {
    const v = await requirePermission("edit");
    const provider = getAiProvider(await getSettings(db), await getAiKey(db));
    if (!provider) throw new AppError("Keine KI konfiguriert.");
    const word = await db.word.findUnique({ where: { id: wordId }, include: ENTRY });
    if (!word) throw new AppError("Wort nicht gefunden.", 404);
    const [cats, samples] = await Promise.all([
      db.category.findMany({ select: { name: true, keywords: true } }),
      // Style reference: recent accepted entries that have a definition.
      db.word.findMany({
        where: { status: "ACCEPTED", id: { not: wordId }, definitions: { some: {} } },
        orderBy: { acceptedAt: "desc" },
        take: 3,
        include: ENTRY,
      }),
    ]);
    const content = await provider.suggest({
      term: word.term,
      context: word.submissionNote,
      categories: cats,
      entry: entryText(word),
      examples: samples.map((w) => `${w.term}\n${entryText(w)!.replace(/^/gm, "  ")}`),
    });
    const draft = await db.aiDraft.create({ data: { wordId, provider: provider.id, model: provider.model, content } });
    await audit(db, v.id, "ai.draft", "word", wordId, { draftId: draft.id });
    revalidatePath(`/k/wort/${wordId}/bearbeiten`);
    return { id: draft.id, content };
  });
}

export async function setAiDraftStatusAction(draftId: string, status: "APPLIED" | "DISCARDED") {
  return safeAction(async () => {
    await requirePermission("edit");
    await db.aiDraft.update({ where: { id: draftId }, data: { status } });
    return true;
  });
}
