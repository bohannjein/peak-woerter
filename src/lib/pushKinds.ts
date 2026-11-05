// Kinds of push messages; plain data so client components can list them.
/** What can be pushed. Everything is on for a subscribed browser; User.pushOff lists what is off. */
export const PUSH_KINDS = {
  raetsel: { label: "Tägliche Rätsel", hint: "Um 10 Uhr, wenn die neuen Rätsel da sind.", title: "Neue Rätsel sind da" },
  runde: { label: "Neue Abstimmung", hint: "Ein Wort wartet auf deine Stimme.", title: "Neue Abstimmung", curator: true },
  spaeter: { label: "Später-Liste", hint: "Ein Wort, für das du gestimmt hast, braucht mehr Kontext.", title: "Später-Liste", curator: true },
  aufgenommen: { label: "Dein Wort ist drin", hint: "Ein Wort von dir wurde in die Sammlung aufgenommen.", title: "Aufgenommen" },
  kommentar: { label: "Kommentare", hint: "Neue Kommentare zu Wörtern, die du eingereicht oder kommentiert hast.", title: "Neuer Kommentar" },
  beleg: { label: "Belege", hint: "Jemand hat einen Beleg zu deinem Wort eingetragen.", title: "Neuer Beleg" },
  wahl: { label: "Wort des Jahres", hint: "Wenn eine Runde der Wahl beginnt.", title: "Wort des Jahres" },
} as const;
export type PushKind = keyof typeof PUSH_KINDS;
export const isPushKind = (k: string): k is PushKind => Object.hasOwn(PUSH_KINDS, k);
