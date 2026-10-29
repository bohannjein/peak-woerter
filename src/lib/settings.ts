import type { Db, Tx } from "./db";

export type Settings = {
  setupCompleted: boolean;
  setupTokenHash: string | null;
  require2fa: boolean;
  requirePasskey: boolean;
  /** API kind; the key is stored separately (lib/ai.ts getAiKey). */
  aiProvider: "none" | "openai-compatible" | "anthropic";
  aiBaseUrl: string;
  aiModel: string;
  /** Seats with a vote. A round is decided once this many votes are in. */
  voterCount: number;
  /** From 3 voters: majority (> 50 % Ja) or unanimous (100 % Ja). */
  voteRule: "majority" | "unanimous";
  /** 0 = no deadline. Otherwise open rounds are decided with the votes cast so far. */
  voteDeadlineHours: number;
  /** Master switch: guests may read the collection. */
  guestEnabled: boolean;
  /** Open to everyone without a link: "" = no, "immer" = permanent, ISO date = until then. */
  guestOpenUntil: string;
  /** Minigame: allow voice recordings instead of text. */
  gameVoice: boolean;
  /** Tag words automatically by category keywords. */
  autoTag: boolean;
};

export const DEFAULTS: Settings = {
  setupCompleted: false,
  setupTokenHash: null,
  require2fa: false,
  requirePasskey: false,
  aiProvider: "none",
  aiBaseUrl: "",
  aiModel: "",
  voterCount: 2,
  voteRule: "majority",
  voteDeadlineHours: 0,
  guestEnabled: false,
  guestOpenUntil: "",
  gameVoice: false,
  autoTag: true,
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

/** Guests may look right now without a link. */
export function guestOpenNow(s: Pick<Settings, "guestEnabled" | "guestOpenUntil">, now = new Date()) {
  if (!s.guestEnabled || !s.guestOpenUntil) return false;
  return s.guestOpenUntil === "immer" || new Date(s.guestOpenUntil) > now;
}
