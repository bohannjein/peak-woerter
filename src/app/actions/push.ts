"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireMember } from "@/lib/access";
import { safeAction } from "@/lib/errors";
import { sendPush, subscribe, unsubscribe, vapidKeys } from "@/lib/push";

const Sub = z.object({ endpoint: z.string().url().max(2000), keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }) });

export async function pushKeyAction() {
  return safeAction(async () => {
    await requireMember();
    return (await vapidKeys(db)).publicKey;
  });
}

export async function subscribePushAction(sub: unknown) {
  return safeAction(async () => {
    const v = await requireMember();
    await subscribe(db, v.id, Sub.parse(sub));
    return true;
  });
}

export async function unsubscribePushAction(endpoint: string) {
  return safeAction(async () => {
    const v = await requireMember();
    await unsubscribe(db, v.id, z.string().max(2000).parse(endpoint));
    return true;
  });
}

/** Sends a test reminder to your own browsers. */
export async function testPushAction() {
  return safeAction(async () => {
    const v = await requireMember();
    return sendPush(db, { title: "Test: Neue Rätsel sind da", body: "So sieht die tägliche Erinnerung um 10 Uhr aus.", url: "/spiele", tag: "raetsel-test" }, [v.id]);
  });
}
