import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { audit } from "@/lib/audit";

// Real pronunciation recordings. Stored on the data volume, never in the DB.
const DIR = join(process.env.DATA_DIR ?? "./data", "audio");
const MAX = 3 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
const MIME = Object.fromEntries(Object.entries(TYPES).map(([m, e]) => [e, m]));

type Ctx = { params: Promise<{ wordId: string; position: string }> };

async function find(ctx: Ctx) {
  const { wordId, position } = await ctx.params;
  const pos = Number(position);
  if (!Number.isInteger(pos) || pos < 1) return null;
  return db.pronunciation.findUnique({ where: { wordId_position: { wordId, position: pos } }, include: { word: { select: { isPublic: true } } } });
}

async function curator() {
  const v = await getViewer();
  return v?.seat && v.missing.length === 0 ? v : null;
}

const err = (error: string, status: number) => Response.json({ error }, { status });

export async function GET(_: Request, ctx: Ctx) {
  const p = await find(ctx);
  if (!p?.audioPath) return err("Nicht gefunden.", 404);
  // Internal archive: any logged-in account may listen; drafts only for staff.
  const v = await getViewer();
  if (!v) return err("Nicht gefunden.", 404);
  if (!(p.word.isPublic && p.verified) && !v.seat && !v.isAdmin) return err("Nicht gefunden.", 404);
  const data = await readFile(join(DIR, p.audioPath)).catch(() => null);
  if (!data) return err("Nicht gefunden.", 404);
  return new Response(data, {
    headers: {
      "content-type": MIME[p.audioPath.split(".").pop()!] ?? "application/octet-stream",
      "content-disposition": "inline",
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  const v = await curator();
  if (!v) return err("Keine Berechtigung.", 403);
  const p = await find(ctx);
  if (!p) return err("Aussprache nicht gefunden. Erst speichern, dann Aufnahme hinzufügen.", 404);
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  const ext = TYPES[type];
  if (!ext) return err("Bitte eine Audiodatei (MP3, M4A, WebM, OGG, WAV) wählen.", 415);
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX) return err("Die Aufnahme darf höchstens 3 MB groß sein.", 413);
  await mkdir(DIR, { recursive: true });
  const name = `${p.wordId}-${p.position}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(join(DIR, name), buf);
  if (p.audioPath) await rm(join(DIR, p.audioPath), { force: true });
  await db.pronunciation.update({ where: { id: p.id }, data: { audioPath: name } });
  await audit(db, v.id, "audio.uploaded", "word", p.wordId, { position: p.position });
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const v = await curator();
  if (!v) return err("Keine Berechtigung.", 403);
  const p = await find(ctx);
  if (!p?.audioPath) return err("Nicht gefunden.", 404);
  await rm(join(DIR, p.audioPath), { force: true });
  await db.pronunciation.update({ where: { id: p.id }, data: { audioPath: null } });
  await audit(db, v.id, "audio.deleted", "word", p.wordId, { position: p.position });
  return Response.json({ ok: true });
}
