import { beforeEach, describe, expect, it } from "vitest";
import { db, setup } from "./helpers";
import { castVote } from "@/lib/voting";
import { addComment, submitWord } from "@/lib/words";
import { activity, computeUserStats } from "@/lib/userStats";

let u: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  u = await setup();
});

describe("Nutzerstatistik", () => {
  it("zählt Einreichungen, Stimmen und Trefferquote", async () => {
    const ok = await submitWord(db, { term: "Mumpitz", userId: u.a });
    await castVote(db, { wordId: ok.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: ok.id, userId: u.b, value: "YES" }); // accepted
    const no = await submitWord(db, { term: "Quark", userId: u.a });
    await castVote(db, { wordId: no.id, userId: u.a, value: "YES" });
    await castVote(db, { wordId: no.id, userId: u.b, value: "NO" }); // 1:1 → Später, nobody matched
    await addComment(db, { wordId: ok.id, userId: u.a, body: "Schön." });

    const own = await computeUserStats(db, u.a, { includePrivate: true });
    expect(own.public).toMatchObject({ submitted: 2, accepted: 1, acceptRate: 1, comments: 1, firstAccepted: { term: "Mumpitz" } });
    expect(own.private).toMatchObject({ votes: { total: 2, yes: 2, no: 0, later: 0 }, hitRate: 0.5, ownLater: 1, activeDays: 1 });

    const ben = await computeUserStats(db, u.b, { includePrivate: true });
    expect(ben.private).toMatchObject({ votes: { total: 2, yes: 1, no: 1, later: 0 }, hitRate: 0.5 });

    const other = await computeUserStats(db, u.a, { includePrivate: false });
    expect(other.private).toBeNull();
  });

  it("berechnet Serie, Wochentag und Monate", () => {
    const a = activity(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-05"], "2026-10-30");
    expect(a).toMatchObject({ activeDays: 4, longestStreak: 3, topWeekday: "Montag" });
    expect(a.months).toHaveLength(12);
    expect(a.months.at(-1)).toEqual({ month: "2026-10", days: 1 });
    expect(a.months.at(-2)).toEqual({ month: "2026-09", days: 3 });
  });
});
