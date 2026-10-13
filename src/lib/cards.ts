import type { CardData } from "@/components/WordCard";
import { letterCount } from "./text";
import { formatDate } from "./time";

type EntryLike = {
  term: string;
  cardNumber?: number | null;
  partOfSpeech?: CardData["partOfSpeech"];
  grammar?: string | null;
  acceptedAt?: Date | null;
  definitions?: { text: string }[];
  pronunciations?: { ipa: string; verified: boolean }[];
  examples?: { text: string }[];
  categories?: { category: { name: string; color: string } }[];
  _count?: { rounds: number };
};

/**
 * Card values are real numbers about the word, never invented stats.
 * `showUnverified`: curators see guessed IPA marked with "?", visitors only confirmed IPA.
 */
export function toCard(e: EntryLike, opts: { showUnverified?: boolean; bandLabel?: string } = {}): CardData {
  const ipa = e.pronunciations?.find((p) => p.verified) ?? (opts.showUnverified ? e.pronunciations?.[0] : undefined);
  const values: [string, string | number][] = [["Buchstaben", letterCount(e.term)]];
  if (e.definitions?.length) values.push(["Bedeutungen", e.definitions.length]);
  if (e._count?.rounds) values.push(["Runden", e._count.rounds]);
  if (e.acceptedAt) values.push(["Seit", formatDate(e.acceptedAt, { month: "short", year: "numeric" })]);
  return {
    term: e.term,
    cardNumber: e.cardNumber,
    band: e.categories?.[0]?.category ?? null,
    bandLabel: opts.bandLabel,
    partOfSpeech: e.partOfSpeech,
    grammar: e.grammar,
    ipa: ipa ? { ipa: ipa.ipa, verified: ipa.verified } : null,
    definition: e.definitions?.[0]?.text ?? null,
    example: e.examples?.[0]?.text ?? null,
    values,
  };
}
