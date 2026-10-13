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
