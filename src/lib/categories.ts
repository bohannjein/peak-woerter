// Category band colours. One colour per category; "ink" is the neutral band.
export const BAND_COLORS = ["cobalt", "sun", "grass", "magenta", "orange", "teal", "violet", "ink"] as const;
export type BandColor = (typeof BAND_COLORS)[number];
export const BAND_LABEL: Record<BandColor, string> = {
  cobalt: "Kobaltblau",
  sun: "Sonnengelb",
  grass: "Grasgrün",
  magenta: "Magenta",
  orange: "Orange",
  teal: "Petrol",
  violet: "Violett",
  ink: "Tinte",
};
export const bandClass = (c?: string | null) => `band-${BAND_COLORS.includes(c as BandColor) ? c : "ink"}`;

export const POS_LABEL = {
  SUBSTANTIV: "Substantiv",
  VERB: "Verb",
  ADJEKTIV: "Adjektiv",
  ADVERB: "Adverb",
  INTERJEKTION: "Interjektion",
  REDEWENDUNG: "Redewendung",
  SONSTIGES: "Sonstiges",
} as const;

export const cardNo = (n: number | null | undefined) => (n ? `№ ${String(n).padStart(3, "0")}` : null);
