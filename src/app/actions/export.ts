"use server";

import { db } from "@/lib/db";
import { getGuest, getViewer } from "@/lib/access";
import { formatDate } from "@/lib/time";
import { AppError, safeAction } from "@/lib/errors";

/** Looks a file's SHA-256 (computed in the browser) up in the export log. */
export async function verifyExportAction(hash: string) {
  return safeAction(async () => {
    if (!(await getViewer()) && !(await getGuest())) throw new AppError("Keine Berechtigung.", 403);
    if (!/^[0-9a-f]{64}$/.test(hash)) throw new AppError("Ungültige Prüfsumme.");
    const hit = await db.auditLog.findFirst({
      where: { action: "export.created", data: { path: ["sha256"], equals: hash } },
      include: { actor: { select: { name: true } } },
    });
    if (!hit) return { genuine: false as const };
    const data = hit.data as { format?: string };
    return {
      genuine: true as const,
      at: formatDate(hit.createdAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      by: hit.actor?.name ?? "Gast",
      format: data.format ?? "",
    };
  });
}
