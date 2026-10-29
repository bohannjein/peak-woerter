import type { Metadata } from "next";
import { Download } from "lucide-react";
import { ImportForm } from "./form";

export const metadata: Metadata = { title: "Export & Backup", robots: { index: false } };

function Parts() {
  return (
    <div className="mt-5 flex flex-wrap gap-5">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" name="teil" value="einstellungen" defaultChecked className="size-5" /> Admin-Einstellungen
      </label>
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" name="teil" value="woerter" defaultChecked className="size-5" /> Alle Wörter
      </label>
    </div>
  );
}

export default function Export() {
  return (
    <div className="max-w-2xl space-y-12">
      <section>
        <h2 className="section-title">Export</h2>
        <p className="mt-2 text-ink-2">
          Einstellungen (Abstimmung, Gäste, KI, Sicherheitsregeln, Kategorien) und alle Wörter mit jedem Status, einzeln oder zusammen. Ohne Konten, Stimmen,
          Kommentare und Audioaufnahmen.
        </p>
        <form method="get" action="/api/export">
          <input type="hidden" name="format" value="backup" />
          <Parts />
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn btn-primary">
              <Download size={18} aria-hidden /> Als JSON herunterladen
            </button>
            <a href="/export" className="btn btn-quiet">
              Wortliste in anderen Formaten
            </a>
          </div>
        </form>
      </section>
      <section>
        <h2 className="section-title">Import</h2>
        <p className="mt-2 text-ink-2">
          Eine Exportdatei wieder einspielen. Vorhandene Wörter bleiben unverändert, nur fehlende kommen dazu. Einstellungen werden überschrieben.
        </p>
        <ImportForm />
      </section>
      <section>
        <h2 className="section-title">Server-Backup</h2>
        <p className="mt-2 text-ink-2">Vollständig mit Konten und Audio, auf dem Server:</p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-table-2 p-4 font-mono text-[0.85rem] leading-relaxed">
          {`# Datenbank sichern
docker compose exec -T db pg_dump -U peake -Fc peake > peake-$(date +%F).dump

# Audioaufnahmen sichern
docker run --rm -v peake_appdata:/data -v "$PWD":/out alpine \\
  tar czf /out/peake-audio-$(date +%F).tgz -C /data .`}
        </pre>
      </section>
    </div>
  );
}
