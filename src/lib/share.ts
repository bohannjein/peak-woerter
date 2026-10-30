// Share links for single words. Anyone with the link may see the word's card,
// so the link carries an HMAC of the slug: guessing /teilen/<slug> is not enough.
import { createHmac, timingSafeEqual } from "node:crypto";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { siteUrl } from "./url";

/** Browser snapshots of the real card, uploaded when a member shares (api/karte). */
export const CARD_DIR = join(process.env.DATA_DIR ?? "./data", "cards");
export const cardSnapshotPath = (wordId: string) => join(CARD_DIR, `${wordId}.png`);

/** Changes whenever a new snapshot is uploaded, so messengers fetch the new preview. */
export async function cardVersion(wordId: string) {
  return (await stat(cardSnapshotPath(wordId)).catch(() => null))?.mtimeMs.toFixed(0) ?? "0";
}

export function shareKey(slug: string, secret = process.env.BETTER_AUTH_SECRET ?? "") {
  return createHmac("sha256", secret).update(`share:${slug}`).digest("hex").slice(0, 16);
}

export function checkShareKey(slug: string, key: string | null | undefined, secret?: string) {
  const want = Buffer.from(shareKey(slug, secret));
  const got = Buffer.from(key ?? "");
  return got.length === want.length && timingSafeEqual(got, want);
}

export const shareUrl = (slug: string) => `${siteUrl()}/teilen/${encodeURIComponent(slug)}?k=${shareKey(slug)}`;
/** Relative, so the browser fetches it from the same origin (CSP connect-src 'self'). */
export const cardImagePath = (slug: string, og = false) => `/api/karte/${encodeURIComponent(slug)}?k=${shareKey(slug)}${og ? "&f=og" : ""}`;
export const cardImageUrl = (slug: string, og = false) => `${siteUrl()}${cardImagePath(slug, og)}`;
