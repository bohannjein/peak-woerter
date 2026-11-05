// In-process clock for the self-hosted container (no cron there): checks every
// minute whether the 10:00 puzzle reminder is due. Started from instrumentation.ts.
import { db } from "./db";
import { todaysRound } from "./games";
import { dailyPuzzlePush } from "./push";
import { PUZZLES, type PuzzleKey } from "./puzzles/registry";

const g = globalThis as unknown as { __peakeClock?: NodeJS.Timeout };

async function tick() {
  try {
    await dailyPuzzlePush(db, async (day) => {
      for (const k of Object.keys(PUZZLES) as PuzzleKey[]) await todaysRound(db, k, day);
    });
  } catch (e) {
    console.error("Rätsel-Erinnerung", e);
  }
}

export function startClock() {
  if (g.__peakeClock || !process.env.DATABASE_URL) return;
  g.__peakeClock = setInterval(tick, 60_000);
  g.__peakeClock.unref();
  setTimeout(tick, 5_000).unref();
}
