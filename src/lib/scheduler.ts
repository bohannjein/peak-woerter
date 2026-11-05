// In-process clock for the self-hosted container (no cron there). Every minute:
// closes voting rounds past their deadline, announces election stages, sends the
// 10:00 puzzle reminder and pushes new messages. Started from instrumentation.ts.
import { db } from "./db";
import { announceElections } from "./elections";
import { todaysRound } from "./games";
import { dailyPuzzlePush, flushNotifications } from "./push";
import { PUZZLES, type PuzzleKey } from "./puzzles/registry";
import { settleRounds } from "./voting";

const g = globalThis as unknown as { __peakeClock?: NodeJS.Timeout };

const jobs: [string, () => Promise<unknown>][] = [
  ["Abstimmungen", () => settleRounds(db)],
  ["Wort-des-Jahres-Ankündigung", () => announceElections(db)],
  [
    "Rätsel-Erinnerung",
    () =>
      dailyPuzzlePush(db, async (day) => {
        for (const k of Object.keys(PUZZLES) as PuzzleKey[]) await todaysRound(db, k, day);
      }),
  ],
  // Last, so messages written by the jobs above go out in the same tick.
  ["Push", () => flushNotifications(db)],
];

async function tick() {
  for (const [name, run] of jobs) {
    try {
      await run();
    } catch (e) {
      console.error(name, e);
    }
  }
}

export function startClock() {
  if (g.__peakeClock || !process.env.DATABASE_URL) return;
  g.__peakeClock = setInterval(tick, 60_000);
  g.__peakeClock.unref();
  setTimeout(tick, 5_000).unref();
}
