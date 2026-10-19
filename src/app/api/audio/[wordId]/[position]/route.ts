import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getGuest, getViewer } from "@/lib/access";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { AUDIO_MIME, AUDIO_TYPES, MAX_AUDIO } from "@/lib/audio";

// Real pronunciation recordings. Stored on the data volume, never in the DB.
const DIR = join(process.env.DATA_DIR ?? "./data", "audio");
const MAX = MAX_AUDIO;
const TYPES = AUDIO_TYPES;
const MIME = AUDIO_MIME;

type Ctx = { params: Promise<{ wordId: string; position: string }> };

async function find(ctx: Ctx) {
  const { wordId, position } = await ctx.params;
  const pos = Number(position);
  if (!Number.isInteger(pos) || pos < 1) return null;
  return db.pronunciation.findUnique({ where: { wordId_position: { wordId, position: pos } }, include: { word: { select: { isPublic: true } } } });
}

async function curator() {
  const v = await getViewer();
  return v && can(v, "edit") && v.missing.length === 0 ? v : null;
}

const err = (error: string, status: number) => Response.json({ error }, { status });

export async function GET(_: Request, ctx: Ctx) {
  const p = await find(ctx);
  if (!p?.audioPath) return err("Nicht gefunden.", 404);
  // Accounts and guests may listen to public, confirmed recordings; drafts only for editors.
  const v = await getViewer();
  const isPublic = p.word.isPublic && p.verified;
  if (!(v ? isPublic || can(v, "edit") : isPublic && (await getGuest()))) return err("Nicht gefunden.", 404);
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
