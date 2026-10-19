"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { verifyExportAction } from "@/app/actions/export";

type Result = Awaited<ReturnType<typeof verifyExportAction>>;

/** The file never leaves the browser: only its SHA-256 is sent and looked up. */
export default function Pruefen() {
  const [r, setR] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const check = (file: File) =>
    start(async () => {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      setR(await verifyExportAction(hex));
    });
  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Export prüfen</h1>
      <p className="mt-2 text-ink-2">Wähle eine exportierte Datei. Ist sie unverändert und stammt von hier, wird das bestätigt. Die Datei wird nicht hochgeladen.</p>
      <label className="btn btn-primary mt-8 cursor-pointer">
        {pending && <Loader2 className="animate-spin" size={18} aria-hidden />} Datei wählen
        <input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && check(e.target.files[0])} />
      </label>
      {r && !r.ok && (
        <p role="alert" className="mt-6 rounded-xl border-[1.5px] border-no/60 bg-no/10 px-4 py-3 font-medium">
          {r.error}
        </p>
      )}
      {r?.ok && (
        <p role="status" className={`mt-6 rounded-xl border-[1.5px] px-4 py-3 font-medium ${r.data.genuine ? "border-yes/60 bg-yes/10" : "border-no/60 bg-no/10"}`}>
          {r.data.genuine
            ? `Echt: ${r.data.format.toUpperCase()}-Export vom ${r.data.at}, erstellt von ${r.data.by}. Seitdem unverändert.`
            : "Unbekannt: Diese Datei stammt nicht von hier oder wurde verändert."}
        </p>
      )}
    </div>
  );
}
