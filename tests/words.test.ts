import { beforeEach, describe, expect, it } from "vitest";
import { db, setup } from "./helpers";
import { castVote, openRound } from "@/lib/voting";
import { findDuplicate, saveEntry, submitWord, type EntryInput } from "@/lib/words";
import { normalizeTerm, slugify, cleanIpa } from "@/lib/text";
import { getWordOfDay } from "@/lib/daily";
import { computeWrapped, toPublic } from "@/lib/wrapped";
import { publicWordWhere } from "@/lib/queries";

let u: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  u = await setup();
});

async function accept(term: string, by = u.a) {
  const w = await submitWord(db, { term, userId: by });
  await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
  await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
  return w;
}

const entry = (patch: Partial<EntryInput> = {}): EntryInput => ({
  term: "Mumpitz",
  partOfSpeech: "SUBSTANTIV",
  grammar: "maskulin",
  usage: null,
  origin: null,
  variants: [],
  definitions: [{ text: "Unsinn, Quatsch.", detail: null }],
  pronunciations: [{ ipa: "[ˈmʊmpɪt͡s]", label: null, verified: true }],
  examples: ["Was der da erzählt, ist kompletter Mumpitz."],
  categoryIds: [],
  meaningChanged: false,
  ...patch,
});

describe("Normalisierung", () => {
  it("ignoriert Groß-/Kleinschreibung, Leerzeichen, Anführungszeichen", () => {
    expect(normalizeTerm("  „Mumpitz“ ")).toBe("mumpitz");
    expect(normalizeTerm("Hals   über  Kopf")).toBe(normalizeTerm("hals über kopf"));
    expect(normalizeTerm("STRAẞE")).toBe(normalizeTerm("straße"));
    expect(normalizeTerm("Mum­pitz!")).toBe("mumpitz");
  });
  it("Slugs und IPA", () => {
    expect(slugify("Größenwahn über Bord")).toBe("groessenwahn-ueber-bord");
    expect(cleanIpa(" /ˈmʊmpɪt͡s/ ")).toBe("ˈmʊmpɪt͡s");
  });
});

describe("Duplikaterkennung", () => {
  it("erkennt akzeptiert, ausstehend, später und Negativliste", async () => {
    const acc = await accept("Mumpitz");
    expect(await findDuplicate(db, "MUMPITZ ")).toMatchObject({ kind: "word", status: "ACCEPTED", id: acc.id });

    await submitWord(db, { term: "Firlefanz", userId: u.a });
    expect(await findDuplicate(db, "firlefanz")).toMatchObject({ status: "VOTING" });

    const later = await submitWord(db, { term: "Larifari", userId: u.a });
    await castVote(db, { wordId: later.id, userId: u.a, value: "LATER" });
    await castVote(db, { wordId: later.id, userId: u.b, value: "YES" });
    expect(await findDuplicate(db, "Larifari")).toMatchObject({ status: "LATER" });

    const rej = await submitWord(db, { term: "Synergie", userId: u.a });
    await castVote(db, { wordId: rej.id, userId: u.a, value: "NO" });
    await castVote(db, { wordId: rej.id, userId: u.b, value: "NO" });
    expect(await findDuplicate(db, "synergie")).toMatchObject({ status: "REJECTED" });

    await expect(submitWord(db, { term: "  synergie", userId: u.b })).rejects.toThrow(/Negativliste/);
  });

});

describe("Redaktion", () => {
  it("Definitionen bearbeiten löst keine neue Abstimmung aus", async () => {
    const w = await accept("Mumpitz");
    await saveEntry(db, w.id, u.b, entry());
    await saveEntry(db, w.id, u.a, entry({ definitions: [{ text: "Unsinn.", detail: null }, { text: "Aufgeblasenes Gerede.", detail: "selten" }] }));
    const defs = await db.definition.findMany({ where: { wordId: w.id }, orderBy: { position: "asc" } });
    expect(defs.map((d) => [d.position, d.text])).toEqual([[1, "Unsinn."], [2, "Aufgeblasenes Gerede."]]);
    expect(await db.votingRound.count({ where: { wordId: w.id } })).toBe(1);
    expect((await db.word.findUniqueOrThrow({ where: { id: w.id } })).isPublic).toBe(true);
  });

  it("mehrere Aussprachevarianten, IPA ohne Klammern, unbestätigt markiert", async () => {
    const w = await accept("Chemie");
    await saveEntry(db, w.id, u.a, entry({
      term: "Chemie",
      pronunciations: [
        { ipa: "[çeˈmiː]", label: "Standard", verified: true },
        { ipa: "/keˈmiː/", label: "süddeutsch", verified: false },
      ],
    }));
    const p = await db.pronunciation.findMany({ where: { wordId: w.id }, orderBy: { position: "asc" } });
    expect(p.map((x) => [x.ipa, x.label, x.verified])).toEqual([
      ["çeˈmiː", "Standard", true],
      ["keˈmiː", "süddeutsch", false],
    ]);
  });

  it("Änderung des Begriffs ist wesentlich und startet eine Neubewertung", async () => {
    const w = await accept("Mumpitz");
    const r = await saveEntry(db, w.id, u.a, entry({ term: "Mumpiz" }));
    expect(r.essential).toBe(true);
    const round = await db.votingRound.findFirstOrThrow({ where: { wordId: w.id, closedAt: null } });
    expect(round.kind).toBe("REVIEW");
    const after = await db.word.findUniqueOrThrow({ where: { id: w.id } });
    expect(after).toMatchObject({ term: "Mumpiz", slug: "mumpiz", isPublic: true });
  });

  it("grundlegend geänderte Bedeutung ist wesentlich", async () => {
    const w = await accept("Mumpitz");
    expect((await saveEntry(db, w.id, u.a, entry({ meaningChanged: true }))).essential).toBe(true);
    expect(await db.votingRound.count({ where: { wordId: w.id, kind: "REVIEW" } })).toBe(1);
  });
});

describe("Öffentliche Sichtbarkeit", () => {
  it("nur akzeptierte, nicht vetoierte Wörter sind öffentlich", async () => {
    const a = await accept("Mumpitz");
    await submitWord(db, { term: "Firlefanz", userId: u.a });
    const r = await submitWord(db, { term: "Synergie", userId: u.a });
    await castVote(db, { wordId: r.id, userId: u.a, value: "NO" });
    await castVote(db, { wordId: r.id, userId: u.b, value: "NO" });
    const b = await accept("Kladderadatsch");
    await openRound(db, { wordId: b.id, userId: u.a, kind: "REVIEW" });
    await castVote(db, { wordId: b.id, userId: u.b, value: "NO" });

    const visible = await db.word.findMany({ where: publicWordWhere, select: { id: true } });
    expect(visible.map((v) => v.id)).toEqual([a.id]);
  });
});

describe("Wort des Tages", () => {
  it("leer ohne akzeptierte Wörter", async () => {
    await submitWord(db, { term: "Firlefanz", userId: u.a });
    expect(await getWordOfDay(db, "2026-01-01")).toBeNull();
  });

  it("stabil innerhalb eines Tages, nur öffentliche Wörter, Ersatz bei Sperrung", async () => {
    for (const t of ["Mumpitz", "Kokolores", "Larifari", "Firlefanz"]) await accept(t);
    const day = "2026-03-01";
    const first = await getWordOfDay(db, day);
    const again = await Promise.all([getWordOfDay(db, day), getWordOfDay(db, day), getWordOfDay(db, day)]);
    expect(again.map((w) => w!.id)).toEqual([first!.id, first!.id, first!.id]);

    // Word gets vetoed in a re-evaluation → replaced.
    await openRound(db, { wordId: first!.id, userId: u.a, kind: "REVIEW" });
    await castVote(db, { wordId: first!.id, userId: u.a, value: "NO" });
    const replaced = await getWordOfDay(db, day);
    expect(replaced!.id).not.toBe(first!.id);
    expect(replaced!.isPublic).toBe(true);
    expect(await getWordOfDay(db, day)).toMatchObject({ id: replaced!.id });
  });

  it("Tagesgrenze in Europe/Berlin", async () => {
    const { berlinDay } = await import("@/lib/time");
    expect(berlinDay(new Date("2026-06-30T22:30:00Z"))).toBe("2026-07-01"); // CEST
    expect(berlinDay(new Date("2026-12-31T22:59:00Z"))).toBe("2026-12-31"); // CET
    expect(berlinDay(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01");
  });
});

describe("Peake Wrapped", () => {
  it("rechnet aus gespeicherten Runden, ohne erfundene Werte", async () => {
    await accept("Mumpitz", u.a);
    await accept("Kokolores", u.a);
    const later = await submitWord(db, { term: "Larifari", userId: u.b });
    await castVote(db, { wordId: later.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: later.id, userId: u.b, value: "NO" });
    await openRound(db, { wordId: later.id, userId: u.b, kind: "REVOTE" });
    await castVote(db, { wordId: later.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: later.id, userId: u.b, value: "YES" });
    const rej = await submitWord(db, { term: "Synergie", userId: u.b });
    await castVote(db, { wordId: rej.id, userId: u.a, value: "NO" });
    await castVote(db, { wordId: rej.id, userId: u.b, value: "NO" });

    const year = new Date().getFullYear();
    const w = await computeWrapped(db, year);
    expect(w).toMatchObject({ submitted: 4, accepted: 3, rejected: 1, sentLater: 1, disagreements: 1 });
    expect(w.topSubmitters).toEqual([{ name: "Anna", count: 2 }, { name: "Ben", count: 2 }]);
    expect(w.multiRoundWords).toEqual([{ term: "Larifari", slug: "larifari", rounds: 2 }]);
    expect(w.acceptedWords.map((x) => x.term)).toEqual(["Mumpitz", "Kokolores", "Larifari"]);

    const pub = toPublic(w);
    expect(Object.keys(pub).sort()).toEqual(["accepted", "acceptedWords", "busiestMonth", "topCategories", "year"]);

    const empty = await computeWrapped(db, 1999);
    expect(empty).toMatchObject({ submitted: 0, accepted: 0, busiestMonth: null, topSubmitters: [], topCategories: [] });
  });
});
