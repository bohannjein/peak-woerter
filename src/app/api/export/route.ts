import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { audit } from "@/lib/audit";
import { berlinDay } from "@/lib/time";

export const dynamic = "force-dynamic";

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  const v = await getViewer();
  if (!v?.isAdmin || v.missing.length) return Response.json({ error: "Keine Berechtigung." }, { status: 403 });
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const day = berlinDay();
  await audit(db, v.id, "export", "app", null, { format });

  if (format === "csv") {
    const words = await db.word.findMany({
      where: { status: "ACCEPTED" },
      orderBy: { cardNumber: "asc" },
      include: {
        definitions: { orderBy: { position: "asc" } },
        pronunciations: { orderBy: { position: "asc" } },
        examples: { orderBy: { position: "asc" } },
        categories: { include: { category: true } },
      },
    });
    const head = ["Nr", "Wort", "Wortart", "Lautschrift", "Bedeutung", "Beispiel", "Verwendung", "Herkunft", "Kategorien", "Aufgenommen"];
    const rows = words.map((w) =>
      [
        w.cardNumber,
        w.term,
        w.partOfSpeech,
        w.pronunciations.map((p) => p.ipa).join(" | "),
        w.definitions.map((d) => d.text).join(" | "),
        w.examples.map((e) => e.text).join(" | "),
        w.usage,
        w.origin,
        w.categories.map((c) => c.category.name).join(", "),
        w.acceptedAt?.toISOString().slice(0, 10),
      ]
        .map(csvCell)
        .join(";"),
    );
    return new Response("﻿" + [head.map(csvCell).join(";"), ...rows].join("\r\n"), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="peake-woerter-${day}.csv"` },
    });
  }

  const [users, seats, categories, words, submissions] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, email: true, isAdmin: true, disabled: true, createdAt: true } }),
    db.curatorSeat.findMany(),
    db.category.findMany(),
    db.word.findMany({
      include: {
        definitions: true,
        pronunciations: true,
        examples: true,
        categories: true,
        rounds: { include: { votes: true } },
        comments: true,
      },
    }),
    db.submission.findMany({ omit: { ipHash: true } }),
  ]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, users, seats, categories, words, submissions }, null, 2);
  return new Response(body, {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="peake-woerter-${day}.json"` },
  });
}
