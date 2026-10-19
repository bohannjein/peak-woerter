export const TZ = "Europe/Berlin";

// YYYY-MM-DD of the given instant in Europe/Berlin.
export function berlinDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: TZ, ...opts }).format(new Date(d));
}

export function berlinYear(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric" }).format(d));
}

export function berlinMonth(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, month: "numeric" }).format(d));
}

/** "YYYY-MM-DDTHH:mm" (datetime-local, meant as Berlin time) to an instant. */
export function fromBerlinLocal(s: string): Date {
  const guess = new Date(`${s}Z`);
  const wall = (tz: string) => new Date(guess.toLocaleString("en-US", { timeZone: tz })).getTime();
  return new Date(guess.getTime() - (wall(TZ) - wall("UTC")));
}

/** Instant to a datetime-local value in Berlin time. */
export function toBerlinLocal(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d).replace(" ", "T");
}
