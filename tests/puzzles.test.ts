import { beforeEach, describe, expect, it } from "vitest";
import { db, makeUser, setup } from "./helpers";
import { dailyPuzzlePush, subscribe, unsubscribe, vapidKeys } from "@/lib/push";
import { castVote } from "@/lib/voting";
import { submitWord } from "@/lib/words";
import { answerOf, scoreGuess, wortjagd } from "@/lib/puzzles/wortjagd";
import { quartett } from "@/lib/puzzles/quartett";
import { bedeutung } from "@/lib/puzzles/bedeutung";
import { countSolutions, fullGrid, isValidSolution, makeSudoku, sudoku } from "@/lib/puzzles/sudoku";
import { loadPlay, playMove, puzzleStats, streakOf } from "@/lib/puzzles/play";
import { previousDay, puzzlePool } from "@/lib/games";
import type { PoolWord } from "@/lib/puzzles/types";

// Deterministic random source for the generators.
function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const word = (i: number, term: string, extra: Partial<PoolWord> = {}): PoolWord => ({
  id: `w${i}`, term, slug: `s${i}`, partOfSpeech: "SUBSTANTIV", definition: `Bedeutung ${i}`, categories: [], ...extra,
});

describe("Wortjagd", () => {
  it("Umlaute werden gefaltet, nur einzelne Wörter mit 4–8 Buchstaben", () => {
    expect(answerOf("Mümpitz")).toBe("muempitz");
    expect(answerOf("Fußel")).toBe("fussel");
    expect(answerOf("Oha")).toBeNull();
    expect(answerOf("aus dem Häuschen")).toBeNull();
    expect(answerOf("Kuddelmuddel")).toBeNull();
  });

  it("färbt Doppelbuchstaben nur so oft, wie sie vorkommen", () => {
    expect(scoreGuess("kanne", "nebel")).toEqual(["miss", "miss", "near", "miss", "near"]);
    expect(scoreGuess("eeeee", "nebel")).toEqual(["miss", "hit", "miss", "hit", "miss"]);
    expect(scoreGuess("nebel", "nebel")).toEqual(["hit", "hit", "hit", "hit", "hit"]);
  });

  it("Lösung bleibt verborgen, Tipp nach drei Versuchen, Ende nach sechs", () => {
    const { puzzle } = wortjagd.generate([word(1, "Nebel")], seeded(), new Set())!;
    let s = wortjagd.initial(puzzle, 0);
    expect(JSON.stringify(wortjagd.view(puzzle, s, false))).not.toContain("nebel");
    expect(() => wortjagd.move(puzzle, s, { guess: "abc" }, 0)).toThrow(/5 Buchstaben/);
    for (let i = 0; i < 3; i++) s = wortjagd.move(puzzle, s, { guess: "kanne" }, 0).state;
    expect(wortjagd.view(puzzle, s, false).hint).toBe("Bedeutung 1");
    s = wortjagd.move(puzzle, s, { guess: "kanne" }, 0).state;
    s = wortjagd.move(puzzle, s, { guess: "kanne" }, 0).state;
    const last = wortjagd.move(puzzle, s, { guess: "kanne" }, 0);
    expect(last).toMatchObject({ finished: true, won: false });
    expect(wortjagd.view(puzzle, last.state, true).solution?.term).toBe("Nebel");
  });
});

describe("Quartett", () => {
  const cats = ["a", "b", "c", "d"].map((id) => ({ id, name: `Kat ${id}`, color: "cobalt" }));
  const pool = cats.flatMap((c, ci) => [0, 1, 2, 3, 4].map((i) => word(ci * 10 + i, `${c.id}wort${i}`, { categories: [c] })));
  // A word in two chosen categories must never appear.
  pool.push(word(99, "doppelt", { categories: [cats[0], cats[1]] }));

  it("baut vier eindeutige Gruppen", () => {
    const { puzzle } = quartett.generate(pool, seeded(3), new Set())!;
    expect(puzzle.tiles).toHaveLength(16);
    expect(puzzle.tiles.map((t) => t.term)).not.toContain("doppelt");
    expect(new Set(puzzle.tiles.map((t) => t.term)).size).toBe(16);
  });

  it("zu wenige Kategorien = kein Rätsel", () => {
    expect(quartett.generate(pool.filter((w) => w.categories[0]?.id !== "d"), seeded(), new Set())).toBeNull();
  });

  it("richtig, knapp, doppelt, verloren", () => {
    const { puzzle } = quartett.generate(pool, seeded(5), new Set())!;
    const of = (g: number) => puzzle.tiles.map((t, i) => (t.group === g ? i : -1)).filter((i) => i >= 0);
    let s = quartett.initial(puzzle, 0);
    expect(JSON.stringify(quartett.view(puzzle, s, false).tiles)).not.toContain("group");
    let o = quartett.move(puzzle, s, { tiles: of(0) }, 0);
    expect(o.state.last).toBe("richtig");
    s = o.state;
    const near = [...of(1).slice(0, 3), of(2)[0]];
    o = quartett.move(puzzle, s, { tiles: near }, 0);
    expect(o.state).toMatchObject({ last: "knapp", mistakes: 1 });
    o = quartett.move(puzzle, o.state, { tiles: near }, 0);
    expect(o.state).toMatchObject({ last: "doppelt", mistakes: 1 });
    expect(() => quartett.move(puzzle, o.state, { tiles: of(0) }, 0)).toThrow(/gelöst/);
    s = o.state;
    for (let i = 1; i < 4; i++) o = quartett.move(puzzle, (s = o.state), { tiles: [of(1)[0], of(2)[i % 4], of(3)[0], of(3)[i]] }, 0);
    expect(o).toMatchObject({ finished: true, won: false });
    expect(quartett.view(puzzle, o.state, true).solved).toHaveLength(4);
  });
});

describe("Echt oder erfunden?", () => {
  it("fünf Fragen, eine echte Bedeutung, Punkte am Ende", () => {
    const pool = [1, 2, 3, 4, 5, 6].map((i) => word(i, `Wort${i}`));
    const { puzzle } = bedeutung.generate(pool, seeded(7), new Set())!;
    expect(puzzle.questions).toHaveLength(5);
    for (const q of puzzle.questions) {
      expect(new Set(q.options).size).toBe(4);
      expect(q.options[q.correct]).toBe(pool.find((w) => w.term === q.term)!.definition);
    }
    let s = bedeutung.initial(puzzle, 0);
    expect(JSON.stringify(bedeutung.view(puzzle, s, false))).not.toContain("correct");
    let o;
    for (const q of puzzle.questions) s = (o = bedeutung.move(puzzle, s, { choice: q.correct }, 0)).state;
    expect(o).toMatchObject({ finished: true, won: true, score: 5 });
    expect(() => bedeutung.move(puzzle, s, { choice: 0 }, 0)).toThrow();
  });

  it("braucht genug Bedeutungen", () => {
    expect(bedeutung.generate([1, 2, 3].map((i) => word(i, `W${i}`)), seeded(), new Set())).toBeNull();
  });
});

describe("Buchstaben-Sudoku", () => {
  it("volle Gitter sind gültig", () => {
    for (let seed = 1; seed < 20; seed++) {
      expect(isValidSolution(fullGrid(6, 2, 3, seeded(seed)), 2, 3)).toBe(true);
      expect(isValidSolution(fullGrid(4, 2, 2, seeded(seed)), 2, 2)).toBe(true);
    }
  });

  it("Rätsel sind eindeutig lösbar", () => {
    const { givens, solution } = makeSudoku(6, 2, 3, 12, seeded(11));
    expect(countSolutions(givens, 2, 3)).toBe(1);
    expect(givens.flat().filter((v) => v !== -1).length).toBeGreaterThanOrEqual(12);
    givens.forEach((r, i) => r.forEach((v, j) => v !== -1 && expect(v).toBe(solution[i][j])));
  });

  it("das Wort steht in der markierten Zeile; Lösen braucht Vorgaben und volle Felder", () => {
    const { puzzle } = sudoku.generate([word(1, "Gurken"), word(2, "Nebel")], seeded(2), new Set())!;
    expect(puzzle.n).toBe(6);
    expect(puzzle.solution[puzzle.row].map((v) => puzzle.letters[v]).join("")).toBe("GURKEN");
    const s = sudoku.initial(puzzle, 1000);
    expect(sudoku.view(puzzle, s, false).solution).toBeNull();
    expect(() => sudoku.move(puzzle, s, { grid: puzzle.givens }, 2000)).toThrow(/ausfüllen/);
    const wrong = puzzle.givens.map((r) => r.map((v) => (v === -1 ? 0 : v)));
    expect(sudoku.move(puzzle, s, { grid: wrong }, 2000)).toMatchObject({ finished: false });
    expect(sudoku.move(puzzle, s, { grid: puzzle.solution }, 61000)).toMatchObject({ finished: true, won: true, durationMs: 60000 });
  });

  it("4×4, wenn kein Sechser-Wort passt", () => {
    const { puzzle } = sudoku.generate([word(1, "Nebel"), word(2, "Moin")], seeded(), new Set())!;
    expect(puzzle.n).toBe(4);
  });
});

describe("Serie", () => {
  it("zählt Tage am Stück bis heute oder gestern", () => {
    const t = "2026-11-05";
    expect(streakOf([t, previousDay(t), previousDay(previousDay(t))], t)).toBe(3);
    expect(streakOf([previousDay(t)], t)).toBe(1);
    expect(streakOf([previousDay(previousDay(t))], t)).toBe(0);
  });
});

describe("Spielstand in der Datenbank", () => {
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

  it("gleiches Rätsel für alle, Zug nach Spielende gesperrt, Statistik", async () => {
    await accepted("Nebel");
    expect((await puzzlePool(db)).map((w) => w.term)).toEqual(["Nebel"]);
    const day = "2026-11-05";
    const a = await loadPlay(db, "wortjagd", u.a, day);
    const b = await loadPlay(db, "wortjagd", u.b, day);
    expect(a?.view.length).toBe(5);
    expect(b?.view.length).toBe(5);
    expect(await loadPlay(db, "quartett", u.a, day)).toBeNull();
    const done = await playMove(db, "wortjagd", u.a, { guess: "Nebel" }, day);
    expect(done).toMatchObject({ finished: true, won: true, score: 1 });
    await expect(playMove(db, "wortjagd", u.a, { guess: "nebel" }, day)).rejects.toThrow(/gespielt/);
    expect((await loadPlay(db, "wortjagd", u.b, day))?.finished).toBe(false);
    const stats = await puzzleStats(db, u.a, day);
    expect(stats.games.wortjagd).toMatchObject({ today: "won", streak: 1, won: 1 });
  });
});

describe("Rätsel-Erinnerung", () => {
  beforeEach(async () => {
    await setup();
  });

  it("frühestens um 10 Uhr Berliner Zeit, genau einmal pro Tag", async () => {
    const days: string[] = [];
    const prepare = async (d: string) => void days.push(d);
    // 08:30 UTC = 09:30 in Berlin (Winterzeit).
    expect(await dailyPuzzlePush(db, prepare, new Date("2026-11-05T08:30:00Z"))).toBe(false);
    expect(await dailyPuzzlePush(db, prepare, new Date("2026-11-05T09:00:00Z"))).toBe(true);
    expect(await dailyPuzzlePush(db, prepare, new Date("2026-11-05T09:01:00Z"))).toBe(false);
    expect(await dailyPuzzlePush(db, prepare, new Date("2026-11-06T09:05:00Z"))).toBe(true);
    expect(days).toEqual(["2026-11-05", "2026-11-06"]);
  });

  it("Abo gehört dem, der zuletzt abonniert hat; Schlüssel bleiben stabil", async () => {
    const [a, b] = await Promise.all([makeUser("Pia"), makeUser("Tom")]);
    const sub = { endpoint: "https://push.example.test/abc", keys: { p256dh: "k", auth: "a" } };
    await subscribe(db, a, sub);
    await subscribe(db, b, sub);
    expect(await db.pushSubscription.findMany({ select: { userId: true } })).toEqual([{ userId: b }]);
    await unsubscribe(db, a, sub.endpoint);
    expect(await db.pushSubscription.count()).toBe(1);
    await unsubscribe(db, b, sub.endpoint);
    expect(await db.pushSubscription.count()).toBe(0);
    await expect(subscribe(db, a, { ...sub, endpoint: "http://unsicher.test" })).rejects.toThrow();
    const k1 = await vapidKeys(db);
    expect(await vapidKeys(db)).toEqual(k1);
  });
});
