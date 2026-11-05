"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { submitEntry, voteEntry } from "@/lib/games";
import { AppError, safeAction } from "@/lib/errors";
import { isPuzzle } from "@/lib/puzzles/registry";
import { playMove } from "@/lib/puzzles/play";

export async function submitSentenceAction(_: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireMember();
    await submitEntry(db, { userId: v.id, text: String(fd.get("text") ?? "").slice(0, 400) });
    revalidatePath("/spiele/satz");
    return true;
  });
}

export async function voteSentenceAction(entryId: string) {
  return safeAction(async () => {
    const v = await requireMember();
    await voteEntry(db, { voterId: v.id, entryId: z.string().min(1).max(64).parse(entryId) });
    revalidatePath("/spiele/satz");
    return true;
  });
}

export async function puzzleMoveAction(game: string, input: unknown) {
  return safeAction(async () => {
    const v = await requireMember();
    if (!isPuzzle(game)) throw new AppError("Unbekanntes Rätsel.", 404);
    const r = await playMove(db, game, v.id, input);
    if (r.finished) {
      revalidatePath("/spiele");
      revalidatePath(`/spiele/${game}`); // the group results below the game
    }
    return r;
  });
}
