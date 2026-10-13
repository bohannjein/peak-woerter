"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCurator } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { getAiProvider } from "@/lib/ai";
import { AppError, safeAction } from "@/lib/errors";
import { audit } from "@/lib/audit";

export async function requestAiDraftAction(wordId: string) {
  return safeAction(async () => {
    const v = await requireCurator();
    const provider = getAiProvider(await getSettings(db));
    if (!provider) throw new AppError("Keine KI konfiguriert.");
    const word = await db.word.findUnique({ where: { id: wordId } });
    if (!word) throw new AppError("Wort nicht gefunden.", 404);
    const cats = await db.category.findMany({ select: { name: true } });
    const content = await provider.suggest({ term: word.term, context: word.submissionNote, categories: cats.map((c) => c.name) });
    const draft = await db.aiDraft.create({ data: { wordId, provider: provider.id, model: provider.model, content } });
    await audit(db, v.id, "ai.draft", "word", wordId, { draftId: draft.id });
    revalidatePath(`/k/wort/${wordId}/bearbeiten`);
    return { id: draft.id, content };
  });
}

export async function setAiDraftStatusAction(draftId: string, status: "APPLIED" | "DISCARDED") {
  return safeAction(async () => {
    await requireCurator();
    await db.aiDraft.update({ where: { id: draftId }, data: { status } });
    return true;
  });
}
