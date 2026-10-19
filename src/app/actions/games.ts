"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { submitEntry, voteEntry } from "@/lib/games";
import { safeAction } from "@/lib/errors";

export async function submitSentenceAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireMember();
    await submitEntry(db, { userId: v.id, text: String(fd.get("text") ?? "").slice(0, 400) });
    revalidatePath("/spiele");
    return true;
  });
}

export async function voteSentenceAction(entryId: string) {
  return safeAction(async () => {
    const v = await requireMember();
    await voteEntry(db, { voterId: v.id, entryId: z.string().min(1).max(64).parse(entryId) });
    revalidatePath("/spiele");
    return true;
  });
}
