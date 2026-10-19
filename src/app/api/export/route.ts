import { db } from "@/lib/db";
import { getGuest, getViewer } from "@/lib/access";
import { audit } from "@/lib/audit";
import { FORMATS, exportRows, render, sha256, sign, type Format, type Order } from "@/lib/export";
import { sfwOn } from "@/lib/sfw";

export const dynamic = "force-dynamic";

const deny = () => Response.json({ error: "Keine Berechtigung." }, { status: 403 });

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const v = await getViewer();
  if (sp.get("format") === "backup") return backup(v);

  // The word list: every account and every guest may export it.
  const guest = v ? null : await getGuest();
  if (v ? v.missing.length > 0 : !guest) return deny();
  const format = (sp.get("format") ?? "") in FORMATS ? (sp.get("format") as Format) : "csv";
  const order: Order = sp.get("sort") === "neu" || sp.get("sort") === "kat" ? (sp.get("sort") as Order) : "az";

  const exportedAt = new Date().toISOString();
  const rows = await exportRows(db, order, await sfwOn());
  const signature = sign(exportedAt, rows);
  const body = render(format, rows, { exportedAt, signature, by: v?.name ?? "Gast" });
  await audit(db, v?.id ?? null, "export.created", "app", null, { format, order, rows: rows.length, sha256: sha256(body), signature, guest: !v });

  const stamp = exportedAt.slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": FORMATS[format].mime,
      "content-disposition": `attachment; filename="peake-woerter-${stamp}.${format}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

/** Admin backup: everything except credentials. */
async function backup(v: Awaited<ReturnType<typeof getViewer>>) {
  if (!v?.isAdmin || v.missing.length) return deny();
  await audit(db, v.id, "export", "app", null, { format: "backup" });
  const [users, seats, categories, words, submissions, elections, games] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, email: true, isAdmin: true, disabled: true, permissions: true, bio: true, favoriteWordId: true, createdAt: true } }),
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
    db.election.findMany({ include: { votes: { omit: { guestId: true } } } }),
    db.gameRound.findMany({ include: { entries: true, votes: true } }),
  ]);
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), version: 2, users, seats, categories, words, submissions, elections, games }, null, 2);
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="peake-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
