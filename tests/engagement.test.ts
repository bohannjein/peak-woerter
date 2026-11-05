import { beforeEach, describe, expect, it, vi } from "vitest";

// No real push service in tests: record what would be sent.
const sent: { endpoint: string; payload: { title: string; body: string; url: string } }[] = [];
vi.mock("web-push", () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }),
    sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
      sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
      return {};
    }),
  },
}));

import { db, setup } from "./helpers";
import { flushNotifications, setPushOff, subscribe } from "@/lib/push";
import { castVote } from "@/lib/voting";
import { addComment, submitWord } from "@/lib/words";
import { announceElections } from "@/lib/elections";
import { compareResults, groupResults, resultLabel, type PlayFacts } from "@/lib/puzzles/group";
import { loadPlay, playMove } from "@/lib/puzzles/play";
import { addSighting, cleanSighting, deleteSighting, sightingsOf } from "@/lib/sightings";

let u: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  u = await setup();
  sent.length = 0;
});

async function accepted(term: string, by = u.a) {
  const w = await submitWord(db, { term, userId: by });
  await castVote(db, { wordId: w.id, userId: u.a, value: "YES" });
  await castVote(db, { wordId: w.id, userId: u.b, value: "YES" });
  return w;
}

const inbox = (userId: string) => db.notification.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { kind: true, body: true } });
const sub = (userId: string, name: string) => subscribe(db, userId, { endpoint: `https://push.example.test/${name}`, keys: { p256dh: "k", auth: "a" } });

describe("Nachrichten zu Ereignissen", () => {
  it("neue Abstimmung für die anderen Kuratoren, Aufnahme für die einreichende Person", async () => {
    const w = await accepted("Mümpitz");
    expect(await inbox(u.b)).toEqual([{ kind: "runde", body: "Neues Wort zur Abstimmung: „Mümpitz“" }]);
    expect(await inbox(u.a)).toEqual([{ kind: "aufgenommen", body: "„Mümpitz“ ist jetzt in der Sammlung (№ 001)." }]);
    expect(await inbox(u.outsider)).toEqual([]);
    expect(w.term).toBe("Mümpitz");
  });

  it("Kommentare erreichen Einreicher und frühere Schreiber, nie die Person selbst", async () => {
    const w = await submitWord(db, { term: "Bammel", userId: u.a });
    await db.notification.deleteMany();
    await addComment(db, { wordId: w.id, userId: u.b, body: "Kenne ich aus Sachsen." });
    expect(await inbox(u.a)).toEqual([{ kind: "kommentar", body: "Ben zu „Bammel“: Kenne ich aus Sachsen." }]);
    expect(await inbox(u.b)).toEqual([]);
    await addComment(db, { wordId: w.id, userId: u.a, body: "x".repeat(200) });
    const [n] = await inbox(u.b);
    expect(n.kind).toBe("kommentar");
    expect(n.body.length).toBeLessThan(120);
    expect(await inbox(u.a)).toHaveLength(1);
  });
});

describe("Push für Nachrichten", () => {
  it("einmal senden, abgeschaltete Arten und alte Nachrichten auslassen", async () => {
    await Promise.all([sub(u.a, "a"), sub(u.b, "b")]);
    await setPushOff(db, u.b, "kommentar", true);
    const now = new Date();
    await db.notification.createMany({
      data: [
        { userId: u.a, kind: "kommentar", body: "für Anna", href: "/k/wort/1" },
        { userId: u.b, kind: "kommentar", body: "Ben will das nicht" },
        { userId: u.b, kind: "runde", body: "für Ben" },
        { userId: u.a, body: "nur in der App" },
        { userId: u.a, kind: "runde", body: "zu alt", createdAt: new Date(now.getTime() - 7 * 3600_000) },
      ],
    });
    const r = await flushNotifications(db, now);
    expect(r.claimed).toBe(5);
    expect(sent.map((s) => [s.endpoint.slice(-1), s.payload.body, s.payload.url]).sort()).toEqual([
      ["a", "für Anna", "/k/wort/1"],
      ["b", "für Ben", "/nachrichten"],
    ]);
    expect((await flushNotifications(db, now)).claimed).toBe(0);
    expect(await db.notification.count({ where: { pushedAt: null } })).toBe(0);
  });

  it("viele auf einmal werden zu einer Mitteilung", async () => {
    await sub(u.a, "a");
    await db.notification.createMany({ data: Array.from({ length: 5 }, (_, i) => ({ userId: u.a, kind: "runde", body: `Wort ${i}` })) });
    await flushNotifications(db);
    expect(sent.map((s) => s.payload.body)).toEqual(["5 neue Nachrichten"]);
  });

  it("tägliche Rätsel abgeschaltet: keine Erinnerung", async () => {
    const { dailyPuzzlePush } = await import("@/lib/push");
    await Promise.all([sub(u.a, "a"), sub(u.b, "b")]);
    await setPushOff(db, u.a, "raetsel", true);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.a } })).pushOff).toEqual(["raetsel"]);
    await dailyPuzzlePush(db, async () => {}, new Date("2026-11-05T09:30:00Z"));
    expect(sent.map((s) => s.endpoint.slice(-1))).toEqual(["b"]);
    await setPushOff(db, u.a, "raetsel", false);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.a } })).pushOff).toEqual([]);
  });
});

describe("Wort-des-Jahres-Ankündigung", () => {
  it("jede Runde einmal, verpasste Runden still", async () => {
    const t = (h: number) => new Date(Date.UTC(2026, 11, 1) + h * 3600_000);
    await db.election.create({ data: { kind: "JURY", year: 2026, nominateFrom: t(0), shortlistFrom: t(48), finalFrom: t(96), endsAt: t(144) } });
    expect(await announceElections(db, t(-1))).toBe(0);
    expect(await announceElections(db, t(1))).toBe(1);
    expect(await announceElections(db, t(2))).toBe(0);
    expect(await announceElections(db, t(49))).toBe(1);
    // Server was down for the whole final: claimed, but not announced a day late.
    expect(await announceElections(db, t(130))).toBe(0);
    const bodies = (await inbox(u.outsider)).map((n) => n.body);
    expect(bodies).toEqual(["Die Wahl zum Wort des Jahres 2026 hat begonnen: Jetzt kannst du nominieren.", "Die Wahl zum Wort des Jahres 2026 geht in die Vorauswahl."]);
  });
});

describe("Tagesergebnis der Gruppe", () => {
  const p = (x: Partial<PlayFacts>): PlayFacts => ({ finished: true, won: true, score: null, durationMs: null, updatedAt: new Date(0), ...x });

  it("Beschriftung und Reihenfolge je Spiel", () => {
    expect(resultLabel("wortjagd", p({ score: 3 }))).toBe("3/6");
    expect(resultLabel("wortjagd", p({ won: false }))).toBe("X/6");
    expect(resultLabel("quartett", p({ score: 0 }))).toBe("ohne Fehler");
    expect(resultLabel("quartett", p({ won: false }))).toBe("nicht gelöst");
    expect(resultLabel("bedeutung", p({ won: false, score: 4 }))).toBe("4/5 richtig");
    expect(resultLabel("sudoku", p({ durationMs: 125_000 }))).toBe("2:05");
    expect(resultLabel("sudoku", p({ finished: false, won: false }))).toBe("spielt noch");
    const rows = [p({ score: 4 }), p({ finished: false, won: false }), p({ won: false, score: null }), p({ score: 2, updatedAt: new Date(5) }), p({ score: 2 })];
    expect(rows.sort((a, b) => compareResults("wortjagd", a, b)).map((r) => resultLabel("wortjagd", r))).toEqual(["2/6", "2/6", "4/6", "X/6", "spielt noch"]);
    expect([p({ score: 3 }), p({ score: 5 })].sort((a, b) => compareResults("bedeutung", a, b))[0].score).toBe(5);
  });

  it("aus der Datenbank, mit allen, die angefangen haben", async () => {
    await accepted("Nebel");
    const day = "2026-11-05";
    await playMove(db, "wortjagd", u.b, { guess: "abcde" }, day);
    await playMove(db, "wortjagd", u.b, { guess: "nebel" }, day);
    await playMove(db, "wortjagd", u.a, { guess: "nebel" }, day);
    await loadPlay(db, "wortjagd", u.outsider, day);
    const rows = await groupResults(db, "wortjagd", day);
    expect(rows.map((r) => [r.user.name, r.label])).toEqual([
      ["Anna", "1/6"],
      ["Ben", "2/6"],
      ["Gast", "spielt noch"],
    ]);
  });
});

describe("Belege", () => {
  it("prüft die Eingaben", () => {
    const ok = { saidOn: "2026-07-12", occasion: " Grillabend " };
    expect(cleanSighting({ ...ok, quote: "„Das ist doch Mümpitz!“" }, "2026-11-05")).toMatchObject({ occasion: "Grillabend", quote: "Das ist doch Mümpitz!", saidBy: null });
    expect(() => cleanSighting({ ...ok, saidOn: "2026-11-06" }, "2026-11-05")).toThrow(/Zukunft/);
    expect(() => cleanSighting({ ...ok, saidOn: "12.07.2026" })).toThrow(/Datum/);
    expect(() => cleanSighting({ ...ok, occasion: "  " })).toThrow(/Gelegenheit/);
    expect(() => cleanSighting({ ...ok, quote: "x".repeat(301) })).toThrow(/zu lang/);
  });

  it("speichern, Nachricht an die einreichende Person, löschen nur eigene", async () => {
    const w = await accepted("Mümpitz");
    await db.notification.deleteMany();
    const own = await addSighting(db, { wordId: w.id, userId: u.a, saidOn: "2026-06-01", occasion: "Zuhause" });
    expect(await inbox(u.a)).toEqual([]);
    const other = await addSighting(db, { wordId: w.id, userId: u.outsider, saidOn: "2026-07-12", occasion: "Grillabend", saidBy: "Tom" });
    expect(await inbox(u.a)).toEqual([{ kind: "beleg", body: "Gast hat „Mümpitz“ belegt: Grillabend" }]);
    expect((await sightingsOf(db, w.id)).map((s) => s.occasion)).toEqual(["Grillabend", "Zuhause"]);
    await expect(deleteSighting(db, own.id, { id: u.b, isAdmin: false })).rejects.toThrow(/eigene/);
    await deleteSighting(db, own.id, { id: u.a, isAdmin: false });
    await deleteSighting(db, other.id, { id: u.admin, isAdmin: true });
    expect(await sightingsOf(db, w.id)).toEqual([]);
  });

  it("nur für Wörter in der Sammlung", async () => {
    const w = await submitWord(db, { term: "Fernweh", userId: u.a });
    await expect(addSighting(db, { wordId: w.id, userId: u.a, saidOn: "2026-06-01", occasion: "Urlaub" })).rejects.toThrow(/nicht gefunden/);
  });
});
