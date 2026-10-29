import { beforeEach, describe, expect, it } from "vitest";
import { db, setup } from "./helpers";
import { castVote } from "@/lib/voting";
import { submitWord } from "@/lib/words";
import { getSettings, setSettings } from "@/lib/settings";
import { exportData, importData, parseImport } from "@/lib/transfer";

let u: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  u = await setup();
});

describe("Export/Import", () => {
  it("bringt Einstellungen, Kategorien und Wörter zurück und überspringt Vorhandenes", async () => {
    await setSettings(db, { voteRule: "unanimous", autoTag: false });
    const cat = await db.category.create({ data: { name: "Essen", slug: "essen", color: "sun", nsfw: true } });
    const ok = await submitWord(db, { term: "Mumpitz", userId: u.a });
    await castVote(db, { wordId: ok.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: ok.id, userId: u.b, value: "YES" });
    await db.wordCategory.create({ data: { wordId: ok.id, categoryId: cat.id } });
    await submitWord(db, { term: "Firlefanz", userId: u.a });

    const file = parseImport(JSON.stringify(await exportData(db, ["einstellungen", "woerter"])));
    await db.word.deleteMany({ where: { term: "Firlefanz" } });
    await db.word.deleteMany({ where: { term: "Mumpitz" } });
    await db.category.deleteMany({});
    await db.appSetting.deleteMany({});

    const r = await importData(db, file, ["einstellungen", "woerter"], u.admin);
    expect(r).toMatchObject({ words: 2, skipped: 0, categories: 1 });
    expect(await getSettings(db)).toMatchObject({ voteRule: "unanimous", autoTag: false });

    const m = await db.word.findUniqueOrThrow({ where: { normalized: "mumpitz" }, include: { categories: { include: { category: true } } } });
    expect(m).toMatchObject({ status: "ACCEPTED", isPublic: true, cardNumber: 1 });
    expect(m.categories[0].category).toMatchObject({ name: "Essen", nsfw: true });
    const f = await db.word.findUniqueOrThrow({ where: { normalized: "firlefanz" }, include: { rounds: true } });
    expect(f.rounds).toHaveLength(1);

    const again = await importData(db, file, ["woerter"], u.admin);
    expect(again).toMatchObject({ words: 0, skipped: 2 });
  });

  it("lehnt fremde Dateien ab", () => {
    expect(() => parseImport('{"foo":1}')).toThrow(/Peake/);
    expect(() => parseImport("kein json")).toThrow(/JSON/);
  });
});
