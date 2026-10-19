import Link from "next/link";
import type { Metadata } from "next";
import { Download, Printer, ShieldCheck } from "lucide-react";
import { FORMATS } from "@/lib/export";

export const metadata: Metadata = { title: "Liste exportieren", robots: { index: false } };

const ORDERS = [
  ["az", "Alphabetisch"],
  ["neu", "Nach Aufnahmedatum"],
  ["kat", "Nach Kategorien"],
] as const;

/** Plain GET form: the browser downloads the file, no JS needed. */
export default function Export() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Liste exportieren</h1>
      <p className="mt-2 text-ink-2">Alle Wörter der Sammlung, mit Zeitstempel und Signatur. Im SFW-Modus ohne 18+-Wörter.</p>

      <form action="/api/export" method="get" className="mt-8 space-y-6">
        <fieldset>
          <legend className="label">Format</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FORMATS).map(([k, f], i) => (
              <label key={k} className="chip cursor-pointer has-[:checked]:bg-ink has-[:checked]:text-table">
                <input type="radio" name="format" value={k} defaultChecked={i === 0} className="sr-only" />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Sortierung</legend>
          <div className="flex flex-wrap gap-2">
            {ORDERS.map(([k, label], i) => (
              <label key={k} className="chip cursor-pointer has-[:checked]:bg-ink has-[:checked]:text-table">
                <input type="radio" name="sort" value={k} defaultChecked={i === 0} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary">
            <Download size={18} aria-hidden /> Herunterladen
          </button>
          <button formAction="/export/druck" className="btn btn-quiet">
            <Printer size={18} aria-hidden /> Als PDF (Druckansicht)
          </button>
        </div>
      </form>

      <p className="mt-10 border-t border-line pt-5 text-sm text-ink-2">
        <Link href="/export/pruefen" className="inline-flex items-center gap-1.5 font-semibold text-ink underline">
          <ShieldCheck size={16} aria-hidden /> Export auf Echtheit prüfen
        </Link>
      </p>
    </div>
  );
}
