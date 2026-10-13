// Normalisation used for duplicate detection: case, whitespace, quotes and
// invisible characters must not create a "new" word.
export function normalizeTerm(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[­​-‍﻿]/g, "") // soft hyphen, zero-width
    .replace(/[„“”"‚‘’'«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .toLocaleLowerCase("de-DE");
}

// Display form: trimmed, single spaces, no surrounding quotes.
export function cleanTerm(input: string): string {
  return input.normalize("NFC").replace(/[­​-‍﻿]/g, "").replace(/\s+/g, " ").trim().replace(/^[„“”"‚‘’'«»]+|[„“”"‚‘’'«»]+$/g, "");
}

export function slugify(input: string): string {
  const s = normalizeTerm(input)
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "wort";
}

// IPA is stored without brackets; strip what people paste.
export function cleanIpa(input: string): string {
  return input.normalize("NFC").trim().replace(/^[\[/]+|[\]/]+$/g, "").trim();
}

export function letterCount(term: string): number {
  return [...term.normalize("NFC")].filter((c) => /\p{L}/u.test(c)).length;
}
