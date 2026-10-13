import { beforeEach, describe, expect, it } from "vitest";
import { db, setup } from "./helpers";
import { castVote, decide, openRound, retractVote } from "@/lib/voting";
import { submitWord } from "@/lib/words";

let u: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  u = await setup();
});

const word = (term = "Mumpitz") => submitWord(db, { term, userId: u.a });
const status = async (id: string) => db.word.findUniqueOrThrow({ where: { id } });

describe("decide (Entscheidungstabelle)", () => {
  it.each([
    ["YES", "YES", "ACCEPTED"],
    ["YES", "NO", "LATER"],
    ["NO", "YES", "LATER"],
    ["NO", "NO", "REJECTED"],
    ["LATER", "YES", "LATER"],
    ["YES", "LATER", "LATER"],
    ["LATER", "NO", "LATER"],
    ["LATER", "LATER", "LATER"],
  ] as const)("%s + %s = %s", (a, b, out) => expect(decide(a, b)).toBe(out));

  it("fehlende Stimme = ausstehend", () => {
    expect(decide("YES", undefined)).toBeNull();
    expect(decide(undefined, "NO")).toBeNull();
  });
});

describe("Abstimmung", () => {
  it("beide Ja = akzeptiert, öffentlich, Kartennummer", async () => {
    const w = await word();
    expect((await castVote(db, { wordId: w.id, userId: u.a, value: "YES" })).outcome).toBeNull();
    expect((await status(w.id)).status).toBe("VOTING");
    expect((await castVote(db, { wordId: w.id, userId: u.b, value: "YES" })).outcome).toBe("ACCEPTED");
    const s = await status(w.id);
    expect(s).toMatchObject({ status: "ACCEPTED", isPublic: true, cardNumber: 1 });
    expect(s.acceptedAt).toBeInstanceOf(Date);
  });

  it("Ja + Nein = Später-Liste", async () => {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    expect((await castVote(db, { wordId: w.id, userId: u.b, value: "NO" })).outcome).toBe("LATER");
    expect(await status(w.id)).toMatchObject({ status: "LATER", isPublic: false });
  });

  it("beide Nein = Negativliste (nicht gelöscht)", async () => {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.a, value: "NO" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "NO" });
    expect(await status(w.id)).toMatchObject({ status: "REJECTED", isPublic: false });
  });

  it("Später-Stimme = Später-Liste", async () => {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    expect((await castVote(db, { wordId: w.id, userId: u.b, value: "LATER" })).outcome).toBe("LATER");
  });

  it("fehlende zweite Stimme = ausstehend", async () => {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.b, value: "NO" });
    expect(await status(w.id)).toMatchObject({ status: "VOTING", isPublic: false });
  });

  it("kein doppeltes Abstimmen", async () => {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    await expect(castVote(db, { wordId: w.id, userId: u.a, value: "NO" })).rejects.toThrow(/schon abgestimmt/);
    expect(await db.vote.count()).toBe(1);
  });

  it("Gäste, Nicht-Kuratoren und Admins ohne Sitz dürfen nicht abstimmen", async () => {
    const w = await word();
    await expect(castVote(db, { wordId: w.id, userId: u.outsider, value: "YES" })).rejects.toThrow(/Nur Kuratoren/);
    await expect(castVote(db, { wordId: w.id, userId: u.admin, value: "YES" })).rejects.toThrow(/Nur Kuratoren/);
    await expect(castVote(db, { wordId: w.id, userId: "nobody", value: "YES" })).rejects.toThrow();
  });

  it("deaktivierte Kuratoren dürfen nicht abstimmen", async () => {
    const w = await word();
    await db.user.update({ where: { id: u.b }, data: { disabled: true } });
    await expect(castVote(db, { wordId: w.id, userId: u.b, value: "YES" })).rejects.toThrow(/deaktiviert/);
  });

  it("gleichzeitige Stimmen beider Kuratoren werden korrekt entschieden", async () => {
    for (let i = 0; i < 5; i++) {
      const w = await word(`Wort${i}`);
      const r = await Promise.all([
        castVote(db, { wordId: w.id, userId: u.a, value: "YES" }),
        castVote(db, { wordId: w.id, userId: u.b, value: "YES" }),
      ]);
      expect(r.map((x) => x.outcome).filter(Boolean)).toEqual(["ACCEPTED"]);
      expect((await status(w.id)).status).toBe("ACCEPTED");
    }
    const numbers = (await db.word.findMany({ select: { cardNumber: true } })).map((w) => w.cardNumber).sort();
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
  });

  it("gleichzeitiger Doppelklick desselben Kurators zählt nur einmal", async () => {
    const w = await word();
    const r = await Promise.allSettled([
      castVote(db, { wordId: w.id, userId: u.a, value: "YES" }),
      castVote(db, { wordId: w.id, userId: u.a, value: "YES" }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.vote.count()).toBe(1);
  });

  it("Rückgängig nimmt die eigene Stimme zurück, solange die Runde offen ist", async () => {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.a, value: "NO" });
    await retractVote(db, { wordId: w.id, userId: u.a });
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
    expect((await status(w.id)).status).toBe("ACCEPTED");
    await expect(retractVote(db, { wordId: w.id, userId: u.a })).rejects.toThrow(/schon entschieden/);
  });
});

describe("Runden und Verlauf", () => {
  it("Später-Liste: neue Runde, alte Stimmen bleiben erhalten", async () => {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "LATER" });
    await openRound(db, { wordId: w.id, userId: u.b, kind: "REVOTE" });
    expect((await status(w.id)).status).toBe("VOTING");
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
    const rounds = await db.votingRound.findMany({ where: { wordId: w.id }, orderBy: { number: "asc" }, include: { votes: true } });
    expect(rounds.map((r) => [r.number, r.kind, r.outcome, r.votes.length])).toEqual([
      [1, "INITIAL", "LATER", 2],
      [2, "REVOTE", "ACCEPTED", 2],
    ]);
  });

  it("nur eine offene Runde pro Wort", async () => {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.a, value: "LATER" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "LATER" });
    const r = await Promise.allSettled([
      openRound(db, { wordId: w.id, userId: u.a, kind: "REVOTE" }),
      openRound(db, { wordId: w.id, userId: u.b, kind: "REVOTE" }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(await db.votingRound.count({ where: { wordId: w.id, closedAt: null } })).toBe(1);
  });

  async function accepted() {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
    await openRound(db, { wordId: w.id, userId: u.a, kind: "REVIEW" });
    return w;
  }

  it("Neubewertung: öffentlich bis zum ersten Nein, dann ausgeblendet", async () => {
    const w = await accepted();
    expect(await status(w.id)).toMatchObject({ status: "ACCEPTED", isPublic: true });
    await castVote(db, { wordId: w.id, userId: u.a, value: "NO" });
    expect(await status(w.id)).toMatchObject({ status: "ACCEPTED", isPublic: false });
    await retractVote(db, { wordId: w.id, userId: u.a });
    expect((await status(w.id)).isPublic).toBe(true);
  });

  it("Neubewertung: beide Ja = erneut akzeptiert, Kartennummer und Aufnahmedatum bleiben", async () => {
    const w = await accepted();
    const before = await status(w.id);
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
    const after = await status(w.id);
    expect(after).toMatchObject({ status: "ACCEPTED", isPublic: true, cardNumber: before.cardNumber });
    expect(after.acceptedAt).toEqual(before.acceptedAt);
  });

  it("Neubewertung: Uneinigkeit = Später, beide Nein = Negativliste", async () => {
    const w1 = await accepted();
    await castVote(db, { wordId: w1.id, userId: u.a, value: "NO" });
    await castVote(db, { wordId: w1.id, userId: u.b, value: "YES" });
    expect(await status(w1.id)).toMatchObject({ status: "LATER", isPublic: false });

    const w2 = await submitWord(db, { term: "Kladderadatsch", userId: u.b });
    await castVote(db, { wordId: w2.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: w2.id, userId: u.b, value: "YES" });
    await openRound(db, { wordId: w2.id, userId: u.b, kind: "REVIEW" });
    await castVote(db, { wordId: w2.id, userId: u.a, value: "NO" });
    await castVote(db, { wordId: w2.id, userId: u.b, value: "NO" });
    expect(await status(w2.id)).toMatchObject({ status: "REJECTED", isPublic: false });
    // History intact: 2 rounds, 4 votes.
    expect(await db.vote.count({ where: { round: { wordId: w2.id } } })).toBe(4);
  });

  it("Neubewertung nur für akzeptierte Wörter", async () => {
    const w = await word();
    await expect(openRound(db, { wordId: w.id, userId: u.a, kind: "REVIEW" })).rejects.toThrow(/keine neue Runde/);
  });

  it("negatives Wort wiederherstellen: erneute Prüfung startet neue Runde", async () => {
    const w = await word();
    await castVote(db, { wordId: w.id, userId: u.a, value: "NO" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "NO" });
    await openRound(db, { wordId: w.id, userId: u.admin, kind: "REVOTE" });
    expect((await status(w.id)).status).toBe("VOTING");
    await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
    expect(await status(w.id)).toMatchObject({ status: "ACCEPTED", isPublic: true });
  });

  it("Datenbank verbietet öffentliche, nicht akzeptierte Wörter", async () => {
    const w = await word();
    await expect(db.word.update({ where: { id: w.id }, data: { isPublic: true } })).rejects.toThrow();
  });
});
