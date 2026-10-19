import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { submitEntry } from "@/lib/games";
import { AUDIO_MIME, AUDIO_TYPES, MAX_AUDIO } from "@/lib/audio";
import { AppError } from "@/lib/errors";

// Minigame voice entries. GET /api/spiel/<entryId> plays one, PUT /api/spiel/neu records today's.
const DIR = join(process.env.DATA_DIR ?? "./data", "game-audio");
type Ctx = { params: Promise<{ entryId: string }> };
const err = (error: string, status: number) => Response.json({ error }, { status });

async function member() {
  const v = await getViewer();
  return v && v.missing.length === 0 ? v : null;
}

export async function GET(_: Request, ctx: Ctx) {
  if (!(await member())) return err("Nicht gefunden.", 404);
  const e = await db.gameEntry.findUnique({ where: { id: (await ctx.params).entryId }, select: { audioPath: true } });
  const data = e?.audioPath ? await readFile(join(DIR, e.audioPath)).catch(() => null) : null;
  if (!data) return err("Nicht gefunden.", 404);
  return new Response(new Uint8Array(data), {
    headers: { "content-type": AUDIO_MIME[e!.audioPath!.split(".").pop()!] ?? "application/octet-stream", "cache-control": "private, max-age=3600", "x-content-type-options": "nosniff" },
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  const v = await member();
  if (!v) return err("Keine Berechtigung.", 403);
  if ((await ctx.params).entryId !== "neu") return err("Nicht gefunden.", 404);
  if (!(await getSettings(db)).gameVoice) return err("Sprachaufnahmen sind ausgeschaltet.", 403);
  const ext = AUDIO_TYPES[(req.headers.get("content-type") ?? "").split(";")[0].trim()];
  if (!ext) return err("Bitte eine Audiodatei (MP3, M4A, WebM, OGG, WAV) wählen.", 415);
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_AUDIO) return err("Die Aufnahme darf höchstens 3 MB groß sein.", 413);
  await mkdir(DIR, { recursive: true });
  const name = `${v.id}-${randomBytes(8).toString("hex")}.${ext}`;
  await writeFile(join(DIR, name), buf);
  try {
    await submitEntry(db, { userId: v.id, audioPath: name });
  } catch (e) {
    await rm(join(DIR, name), { force: true });
    if (e instanceof AppError) return err(e.message, e.status);
    throw e;
  }
  return Response.json({ ok: true });
}
