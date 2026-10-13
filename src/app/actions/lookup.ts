"use server";

import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { duplicateMessageForCurator, findDuplicate } from "@/lib/words";

/** Live duplicate hint while typing (curators only). */
export async function checkDuplicateAction(term: string): Promise<{ message: string; href?: string } | null> {
  const v = await getViewer();
  if (!v || (!v.seat && !v.isAdmin) || !term.trim() || term.length > 120) return null;
  const d = await findDuplicate(db, term);
  const message = duplicateMessageForCurator(d);
  if (!message) return null;
  return { message, href: d.kind === "word" ? `/k/wort/${d.id}` : undefined };
}
