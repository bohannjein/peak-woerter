import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { imageType } from "@/lib/profile";
import { audit } from "@/lib/audit";

// Profile pictures. On the data volume next to the audio files; only accounts can see them.
const DIR = join(process.env.DATA_DIR ?? "./data", "avatars");
const MAX = 2 * 1024 * 1024;
const MIME = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;

type Ctx = { params: Promise<{ userId: string }> };
const err = (error: string, status: number) => Response.json({ error }, { status });

async function member() {
  const v = await getViewer();
  return v && v.missing.length === 0 ? v : null;
}

export async function GET(_: Request, ctx: Ctx) {
  if (!(await member())) return err("Nicht gefunden.", 404);
  const u = await db.user.findUnique({ where: { id: (await ctx.params).userId }, select: { avatarPath: true } });
  const data = u?.avatarPath ? await readFile(join(DIR, u.avatarPath)).catch(() => null) : null;
  if (!data) return err("Nicht gefunden.", 404);
  return new Response(data, {
    headers: {
      "content-type": MIME[u!.avatarPath!.split(".").pop() as keyof typeof MIME] ?? "application/octet-stream",
      "cache-control": "private, max-age=300",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}

/** Own picture only. Type is checked by magic bytes, size by length. */
export async function PUT(req: Request, ctx: Ctx) {
  const v = await member();
  if (!v || v.id !== (await ctx.params).userId) return err("Keine Berechtigung.", 403);
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX) return err("Das Bild darf höchstens 2 MB groß sein.", 413);
  const ext = imageType(buf);
  if (!ext) return err("Bitte ein PNG-, JPEG- oder WebP-Bild wählen.", 415);
  await mkdir(DIR, { recursive: true });
  const name = `${v.id}-${randomBytes(6).toString("hex")}.${ext}`;
  await writeFile(join(DIR, name), buf);
  const old = await db.user.findUnique({ where: { id: v.id }, select: { avatarPath: true } });
  await db.user.update({ where: { id: v.id }, data: { avatarPath: name } });
  if (old?.avatarPath) await rm(join(DIR, old.avatarPath), { force: true });
  await audit(db, v.id, "profile.avatar", "user", v.id);
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, ctx: Ctx) {
  const v = await member();
  if (!v || v.id !== (await ctx.params).userId) return err("Keine Berechtigung.", 403);
  const old = await db.user.findUnique({ where: { id: v.id }, select: { avatarPath: true } });
  if (old?.avatarPath) await rm(join(DIR, old.avatarPath), { force: true });
  await db.user.update({ where: { id: v.id }, data: { avatarPath: null } });
  return Response.json({ ok: true });
}
