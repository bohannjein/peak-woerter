"use server";

import { db } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { AppError, safeAction } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

// Drafts of the word forms, per user, so they follow you to other devices.
const KEY = /^(neu|wort:[A-Za-z0-9_-]{1,40})$/;
const MAX = 100_000; // bytes of JSON; a full entry is a few KB

function checkKey(key: string) {
  if (!KEY.test(key)) throw new AppError("Ungültiger Entwurf.");
}

export async function getDraftAction(key: string) {
  return safeAction(async () => {
    const v = await requireMember();
    checkKey(key);
    const d = await db.draft.findUnique({ where: { userId_key: { userId: v.id, key } } });
    return d ? { value: d.value, at: d.updatedAt.toISOString() } : null;
  });
}

export async function saveDraftAction(key: string, value: unknown) {
  return safeAction(async () => {
    const v = await requireMember();
    checkKey(key);
    if (JSON.stringify(value).length > MAX) throw new AppError("Entwurf ist zu groß.");
    const data = { value: value as Prisma.InputJsonValue };
    await db.draft.upsert({ where: { userId_key: { userId: v.id, key } }, create: { userId: v.id, key, ...data }, update: data });
    return true;
  });
}

export async function deleteDraftAction(key: string) {
  return safeAction(async () => {
    const v = await requireMember();
    checkKey(key);
    await db.draft.deleteMany({ where: { userId: v.id, key } });
    return true;
  });
}
