import type { Db, Tx } from "./db";

export type Settings = {
  setupCompleted: boolean;
  setupTokenHash: string | null;
  require2fa: boolean;
  requirePasskey: boolean;
  aiProvider: "none" | "openai-compatible";
  aiBaseUrl: string;
  aiModel: string;
};

export const DEFAULTS: Settings = {
  setupCompleted: false,
  setupTokenHash: null,
  require2fa: false,
  requirePasskey: false,
  aiProvider: "none",
  aiBaseUrl: "",
  aiModel: "",
};

export async function getSettings(db: Db | Tx): Promise<Settings> {
  const rows = await db.appSetting.findMany();
  const out = { ...DEFAULTS } as Record<string, unknown>;
  for (const r of rows) if (r.key in DEFAULTS) out[r.key] = r.value;
  return out as Settings;
}

export async function setSettings(db: Db | Tx, patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULTS) || value === undefined) continue;
    await db.appSetting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } });
  }
}
