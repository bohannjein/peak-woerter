// Versions and "Was ist neu". Newest first; APP_VERSION is the first entry and
// must match package.json (checked in tests). Semver: new features bump the
// minor number, fixes the patch number.
//
// To release: add an entry on top, bump package.json "version". Everyone who
// saw an older version gets the new entries once as a dialog after login.

export type ChangeItem = { title: string; text: string; href?: string };
export type Release = { version: string; date: string; items: ChangeItem[] };

export const CHANGELOG: Release[] = [
  {
    version: "1.2.1",
    date: "2026-11-06",
    items: [{ title: "Startseite aufgeräumt", text: "Unter der Begrüßung kommen wieder zuerst Suche, Wort des Tages und Neues. Die Abstimmungen stehen darunter.", href: "/" }],
  },
  {
    version: "1.2.0",
    date: "2026-11-06",
    items: [
      { title: "Eine Startseite für alle", text: "Logo und „Start“ zeigen jetzt dieselbe Seite. Kuratoren sehen oben, was auf ihre Stimme wartet, darunter Suche, Wort des Tages und Neues.", href: "/" },
      { title: "Die Gruppe heute", text: "Nach dem täglichen Rätsel siehst du, wie die anderen abgeschnitten haben. Vorher nur, wer schon fertig ist.", href: "/spiele" },
      { title: "Belege", text: "Trag auf der Wortseite ein, wann und wo ein Wort wirklich gefallen ist, gern mit dem Satz dazu. So entsteht pro Wort eine kleine Zeitleiste." },
      { title: "Mehr Mitteilungen", text: "Neue Abstimmungen, aufgenommene Wörter, Kommentare, Belege und die Wort-des-Jahres-Wahl melden sich jetzt auch per Mitteilung. Jede Art lässt sich einzeln abschalten.", href: "/konto#mitteilungen" },
    ],
  },
  {
    version: "1.1.3",
    date: "2026-11-05",
    items: [
      { title: "Tägliche Rätsel", text: "Wortjagd, Quartett, Echt oder erfunden? und Buchstaben-Sudoku, jeden Tag neu aus unserem Archiv.", href: "/spiele" },
      { title: "Erinnerung um 10 Uhr", text: "Auf Wunsch meldet sich der Browser, sobald die neuen Rätsel da sind." },
    ],
  },
];

export const APP_VERSION = CHANGELOG[0].version;

/** -1, 0 or 1, comparing "1.2.0"-style versions number by number. */
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** Releases newer than what the person has seen. */
export const unseenReleases = (seen: string) => CHANGELOG.filter((r) => compareVersions(r.version, seen) > 0);
