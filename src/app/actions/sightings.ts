"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { safeAction } from "@/lib/errors";
import { pushSoon } from "@/lib/push";
import { addSighting, deleteSighting } from "@/lib/sightings";

const Id = z.string().min(1).max(64);
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").slice(0, 2000);

export async function addSightingAction(wordId: string, _: unknown, fd: FormData) {
  return safeAction(async () => {
    const v = await requireMember();
    const s = await addSighting(db, {
      wordId: Id.parse(wordId),
      userId: v.id,
      saidOn: text(fd, "saidOn"),
      occasion: text(fd, "occasion"),
      saidBy: text(fd, "saidBy"),
      quote: text(fd, "quote"),
    });
    revalidatePath(`/wort/${s.slug}`);
    pushSoon(db);
    return true;
  });
}

export async function deleteSightingAction(id: string) {
  return safeAction(async () => {
    const v = await requireMember();
    const slug = await deleteSighting(db, Id.parse(id), v);
    revalidatePath(`/wort/${slug}`);
    return true;
  });
}
