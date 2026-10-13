import type { Metadata } from "next";
import { Download } from "lucide-react";

export const metadata: Metadata = { title: "Export & Backup", robots: { index: false } };

export default function Export() {
  return (
    <div className="max-w-2xl space-y-12">
      <section>
        <h2 className="section-title">Export</h2>
        <p className="mt-2 text-ink-2">Ohne Passwörter und Schlüssel.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href="/api/export?format=json" className="btn btn-primary" download>
            <Download size={18} aria-hidden /> Alles als JSON
          </a>
          <a href="/api/export?format=csv" className="btn btn-quiet" download>
            <Download size={18} aria-hidden /> Sammlung als CSV
          </a>
        </div>
      </section>
      <section>
        <h2 className="section-title">Backup</h2>
        <p className="mt-2 text-ink-2">
          Datenbank und Audio-Volume, auf dem Server:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-table-2 p-4 font-mono text-[0.85rem] leading-relaxed">
          {`# Datenbank sichern
docker compose exec -T db pg_dump -U peake -Fc peake > peake-$(date +%F).dump

# Audioaufnahmen sichern
docker run --rm -v peake_appdata:/data -v "$PWD":/out alpine \\
  tar czf /out/peake-audio-$(date +%F).tgz -C /data .`}
        </pre>
        <p className="mt-3 text-ink-2">Restore und Cronjob: siehe README.</p>
      </section>
    </div>
  );
}
