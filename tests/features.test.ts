import { beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { db, setup } from "./helpers";
import { castVote } from "@/lib/voting";
import { submitWord } from "@/lib/words";
import { setSettings } from "@/lib/settings";
import { createGuestLink, guestSession, isGuestPath, openGuestSession, redeemGuestLink } from "@/lib/guests";
import { castElectionVote, ballot, decideElection, retractElectionVote, stageOf } from "@/lib/elections";
import { gameWins, previousDay, submitEntry, todaysRound, voteEntry } from "@/lib/games";
import { autoTag, matchCategories } from "@/lib/tagging";
import { COLUMNS, exportRows, render, sign } from "@/lib/export";
import { changeEmail, imageType, setFavorite } from "@/lib/profile";
import { can } from "@/lib/permissions";
import { publicWhere } from "@/lib/queries";

let u: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  u = await setup();
});

async function accepted(term: string) {
  const w = await submitWord(db, { term, userId: u.a });
  await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
  await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
  return w;
}

describe("Rechte", () => {
  it("Kuratoren und Admins dürfen alles, Mitglieder nur Gewährtes", () => {
    expect(can({ seat: 1, isAdmin: false, permissions: [] }, "edit")).toBe(true);
    expect(can({ seat: null, isAdmin: true, permissions: [] }, "tags")).toBe(true);
    expect(can({ seat: null, isAdmin: false, permissions: ["tags"] }, "tags")).toBe(true);
    expect(can({ seat: null, isAdmin: false, permissions: ["tags"] }, "edit")).toBe(false);
    expect(can(null, "context")).toBe(false);
  });
});

describe("Gastmodus", () => {
  it("aus = keine Links, keine Sitzungen", async () => {
    await expect(createGuestLink(db, { createdById: u.admin, label: null, singleUse: true, hours: 1 })).rejects.toThrow(/ausgeschaltet/);
    expect(await openGuestSession(db)).toBeNull();
  });

  it("einmaliger Link funktioniert genau einmal", async () => {
    await setSettings(db, { guestEnabled: true });
    const token = await createGuestLink(db, { createdById: u.admin, label: "Oma", singleUse: true, hours: 24 });
    const s = await redeemGuestLink(db, token);
    expect(s).not.toBeNull();
    expect(await redeemGuestLink(db, token)).toBeNull();
    expect(await guestSession(db, s!.token)).not.toBeNull();
    // Master switch off ends every guest session.
    await setSettings(db, { guestEnabled: false });
    expect(await guestSession(db, s!.token)).toBeNull();
  });

  it("Mehrfachlink: jeder Besuch eigene Identität; Widerruf beendet alle", async () => {
    await setSettings(db, { guestEnabled: true });
    const token = await createGuestLink(db, { createdById: u.admin, label: null, singleUse: false, hours: 24 });
    const [a, b] = [await redeemGuestLink(db, token), await redeemGuestLink(db, token)];
    expect((await guestSession(db, a!.token))!.id).not.toBe((await guestSession(db, b!.token))!.id);
    await db.guestAccess.updateMany({ data: { revokedAt: new Date() } });
    expect(await guestSession(db, a!.token)).toBeNull();
  });

  it("offen bis: danach keine Sitzung mehr", async () => {
    await setSettings(db, { guestEnabled: true, guestOpenUntil: new Date(Date.now() + 60_000).toISOString() });
    const s = await openGuestSession(db);
    expect(await guestSession(db, s!.token)).not.toBeNull();
    await setSettings(db, { guestOpenUntil: new Date(Date.now() - 1).toISOString() });
    expect(await guestSession(db, s!.token)).toBeNull();
    expect(await openGuestSession(db)).toBeNull();
  });

  it("Gäste dürfen nur die Sammlung sehen", () => {
    for (const p of ["/", "/woerter", "/wort/mumpitz", "/zufall", "/wort-des-jahres", "/export", "/export/druck"]) expect(isGuestPath(p)).toBe(true);
    for (const p of ["/k", "/k/negativliste", "/admin", "/konto", "/profil/x", "/spiele", "/nachrichten", "/pflege", "/wort/a/b"]) expect(isGuestPath(p)).toBe(false);
  });
});

describe("Wort des Jahres", () => {
  const day = 24 * 3600_000;
  async function election(kind: "JURY" | "COMMUNITY", stageNow: 1 | 2 | 3) {
    const now = Date.now();
    const o = { 1: 0, 2: 1, 3: 2 }[stageNow];
    return db.election.create({
      data: {
        kind,
        year: 2026,
        nominateFrom: new Date(now - (o + 1) * day),
        shortlistFrom: new Date(now - o * day + (stageNow === 1 ? day : 0)),
        finalFrom: new Date(now + (stageNow === 3 ? -1000 : day * 2)),
        endsAt: new Date(now + 3 * day),
        nominations: 2,
        shortlistVotes: 1,
        finalists: 2,
      },
    });
  }

  it("Stufen ergeben sich aus den Terminen", () => {
    const d = (n: number) => new Date(2026, 11, n);
    const e = { nominateFrom: d(1), shortlistFrom: d(10), finalFrom: d(20), endsAt: d(31) };
    expect([d(0), d(5), d(15), d(25), d(31)].map((n) => stageOf(e, n))).toEqual([0, 1, 2, 3, 4]);
  });

  it("Runde 1: begrenzte Nominierungen, keine Downvotes, Gäste nur bei Community", async () => {
    const [w1, w2, w3] = [await accepted("Eins"), await accepted("Zwei"), await accepted("Drei")];
    const e = await election("JURY", 1);
    await castElectionVote(db, { electionId: e.id, voter: { userId: u.a }, wordId: w1.id, value: 1 });
    await castElectionVote(db, { electionId: e.id, voter: { userId: u.a }, wordId: w2.id, value: 1 });
    await expect(castElectionVote(db, { electionId: e.id, voter: { userId: u.a }, wordId: w3.id, value: 1 })).rejects.toThrow(/schon 2/);
    await expect(castElectionVote(db, { electionId: e.id, voter: { userId: u.b }, wordId: w3.id, value: -1 })).rejects.toThrow(/nur nominiert/);
    await expect(castElectionVote(db, { electionId: e.id, voter: { guestId: "x" }, wordId: w3.id, value: 1 })).rejects.toThrow(/nur Mitglieder/);
    await retractElectionVote(db, { electionId: e.id, voter: { userId: u.a }, wordId: w2.id });
    await castElectionVote(db, { electionId: e.id, voter: { userId: u.a }, wordId: w3.id, value: 1 });
  });

  it("Finale: Top-Wörter aus Runde 2, je ein Up- und Downvote, Gewinner wird gespeichert", async () => {
    const ws = [await accepted("Alpha"), await accepted("Beta"), await accepted("Gamma")];
    const e = await election("JURY", 1);
    for (const w of ws) await db.electionVote.create({ data: { electionId: e.id, stage: 1, wordId: w.id, value: 1, userId: u.a } });
    await db.electionVote.createMany({
      data: [
        { electionId: e.id, stage: 2, wordId: ws[1].id, value: 1, userId: u.a },
        { electionId: e.id, stage: 2, wordId: ws[2].id, value: 1, userId: u.b },
        { electionId: e.id, stage: 2, wordId: ws[0].id, value: -1, userId: u.b },
      ],
    });
    // Move to the final.
    await db.election.update({ where: { id: e.id }, data: { shortlistFrom: new Date(Date.now() - 2000), finalFrom: new Date(Date.now() - 1000) } });
    const fin = await ballot(db, e, 3);
    expect(fin?.sort()).toEqual([ws[1].id, ws[2].id].sort());
    await expect(castElectionVote(db, { electionId: e.id, voter: { userId: u.a }, wordId: ws[0].id, value: 1 })).rejects.toThrow(/nicht zur Wahl/);
    await castElectionVote(db, { electionId: e.id, voter: { userId: u.a }, wordId: ws[2].id, value: 1 });
    await expect(castElectionVote(db, { electionId: e.id, voter: { userId: u.a }, wordId: ws[1].id, value: 1 })).rejects.toThrow(/Keine Upvotes/);
    await castElectionVote(db, { electionId: e.id, voter: { userId: u.a }, wordId: ws[1].id, value: -1 });
    await db.election.update({ where: { id: e.id }, data: { endsAt: new Date(Date.now() - 1) } });
    const done = await decideElection(db, e.id);
    expect(done?.winnerWordId).toBe(ws[2].id);
    expect(done?.decidedAt).toBeInstanceOf(Date);
  });

  it("Community: Gast stimmt mit Gastsitzung ab", async () => {
    await setSettings(db, { guestEnabled: true, guestOpenUntil: "immer" });
    const g = await openGuestSession(db);
    const gs = await guestSession(db, g!.token);
    const w = await accepted("Gastwort");
    const e = await election("COMMUNITY", 1);
    await castElectionVote(db, { electionId: e.id, voter: { guestId: gs!.id }, wordId: w.id, value: 1 });
    expect(await db.electionVote.count({ where: { guestId: gs!.id } })).toBe(1);
  });
});

describe("Minispiel", () => {
  it("ein Satz pro Tag, Abstimmung am Folgetag, nicht für sich selbst, Sieg zählt danach", async () => {
    await accepted("Mumpitz");
    const day = "2026-10-01";
    const r = await todaysRound(db, "satz", day);
    expect(r?.day).toBe(day);
    const ea = await submitEntry(db, { userId: u.a, text: "Das ist doch Mumpitz.", day });
    await submitEntry(db, { userId: u.b, text: "Mumpitz zum Frühstück.", day });
    await expect(submitEntry(db, { userId: u.a, text: "Nochmal.", day })).rejects.toThrow(/schon mitgespielt/);
    await expect(voteEntry(db, { voterId: u.b, entryId: ea.id, today: day })).rejects.toThrow(/zu/);
    await expect(voteEntry(db, { voterId: u.a, entryId: ea.id, today: "2026-10-02" })).rejects.toThrow(/selbst/);
    await voteEntry(db, { voterId: u.b, entryId: ea.id, today: "2026-10-02" });
    await expect(voteEntry(db, { voterId: u.b, entryId: ea.id, today: "2026-10-02" })).rejects.toThrow(/schon abgestimmt/);
    expect(await gameWins(db, u.a, "2026-10-02")).toBe(0); // voting still open
    expect(await gameWins(db, u.a, "2026-10-03")).toBe(1);
    expect(await gameWins(db, u.b, "2026-10-03")).toBe(0);
  });

  it("Vortag über Monatsgrenze", () => expect(previousDay("2026-03-01")).toBe("2026-02-28"));
});

describe("Tags und SFW", () => {
  it("Stichwörter treffen Wortanfänge", () => {
    const cats = [
      { id: "essen", keywords: ["koch", "küche"] },
      { id: "tier", keywords: ["hund"] },
    ];
    expect(matchCategories("Kochlöffel in der Küche", cats)).toEqual(["essen"]);
    expect(matchCategories("Schweinehund", cats)).toEqual([]);
  });

  it("neues Wort bekommt Auto-Tag; 18+-Wörter verschwinden im SFW-Modus", async () => {
    const cat = await db.category.create({ data: { name: "Derb", slug: "derb", keywords: ["mist"], nsfw: true } });
    const w = await accepted("Mistkerl");
    expect(await db.wordCategory.findMany({ where: { wordId: w.id } })).toEqual([{ wordId: w.id, categoryId: cat.id, auto: true }]);
    await accepted("Blume");
    expect(await db.word.count({ where: publicWhere(false) })).toBe(2);
    expect(await db.word.count({ where: publicWhere(true) })).toBe(1);
  });

  it("ohne Auto-Tagging keine Tags", async () => {
    await setSettings(db, { autoTag: false });
    await db.category.create({ data: { name: "Derb", slug: "derb", keywords: ["mist"] } });
    const w = await submitWord(db, { term: "Mist", userId: u.a });
    await autoTag(db, w.id);
    expect(await db.wordCategory.count()).toBe(0);
  });
});

describe("Export", () => {
  it("nur öffentliche Felder, Signatur ändert sich mit dem Inhalt, CSV gegen Formel-Injection", async () => {
    await accepted("=Formel");
    await submitWord(db, { term: "Geheim", userId: u.a }); // still voting: never exported
    const rows = await exportRows(db, "az");
    expect(rows.map((r) => r.Wort)).toEqual(["=Formel"]);
    const at = "2026-10-19T10:00:00.000Z";
    expect(sign(at, rows)).not.toBe(sign(at, [{ ...rows[0], Wort: "x" }]));
    const csv = render("csv", rows, { exportedAt: at, signature: "abc", by: "Anna" }).toString();
    expect(csv).toContain(`"'=Formel"`);
    expect(csv).toContain("Signatur");
  });

  it("XLSX ist ein gültiges ZIP mit Arbeitsblatt", async () => {
    await accepted("Kladderadatsch");
    const buf = render("xlsx", await exportRows(db, "neu"), { exportedAt: new Date().toISOString(), signature: "s", by: "Gast" });
    expect(buf.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(buf.includes(Buffer.from("xl/worksheets/sheet1.xml"))).toBe(true);
    expect(buf.includes(Buffer.from("Kladderadatsch"))).toBe(true);
    expect(COLUMNS.length).toBe(10);
  });
});

describe("Profil", () => {
  it("E-Mail ändern nur mit richtigem Passwort", async () => {
    await db.account.create({ data: { id: "acc", accountId: u.b, providerId: "credential", userId: u.b, password: await hashPassword("richtig-langes-pw") } });
    await expect(changeEmail(db, { userId: u.b, password: "falsch", email: "neu@example.test" })).rejects.toThrow(/Passwort/);
    await expect(changeEmail(db, { userId: u.b, password: "richtig-langes-pw", email: "anna@example.test" })).rejects.toThrow(/schon verwendet/);
    await changeEmail(db, { userId: u.b, password: "richtig-langes-pw", email: "Neu@Example.test" });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.b } })).email).toBe("neu@example.test");
  });

  it("Lieblingswort nur aus der Sammlung", async () => {
    const open = await submitWord(db, { term: "Offen", userId: u.a });
    await expect(setFavorite(db, u.b, open.id)).rejects.toThrow(/nicht gefunden/);
    const w = await accepted("Liebling");
    await setFavorite(db, u.b, w.id);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.b } })).favoriteWordId).toBe(w.id);
  });

  it("Bildtyp nur anhand der Bytes", () => {
    expect(imageType(Buffer.from("89504e470d0a1a0a0000", "hex"))).toBe("png");
    expect(imageType(Buffer.from("ffd8ffe000", "hex"))).toBe("jpg");
    expect(imageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
});
