import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { audit } from "@/lib/audit";
import { exportRows, sign, type Order } from "@/lib/export";
import { sfwOn } from "@/lib/sfw";
import { formatDate } from "@/lib/time";
import { PrintNow } from "./PrintNow";

export const metadata: Metadata = { title: "Wortliste", robots: { index: false } };
export const dynamic = "force-dynamic";

/** PDF export = the browser's "Als PDF speichern". Full Unicode (IPA) and our fonts for free. */
export default async function Druck({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const sp = await searchParams;
  const order: Order = sp.sort === "neu" || sp.sort === "kat" ? sp.sort : "az";
  const v = await getViewer();
  const exportedAt = new Date().toISOString();
  const rows = await exportRows(db, order, await sfwOn());
  const signature = sign(exportedAt, rows);
  await audit(db, v?.id ?? null, "export.created", "app", null, { format: "pdf", order, rows: rows.length, signature, guest: !v });

  return (
    <div className="print-sheet mx-auto max-w-3xl px-4 pt-6 md:px-6">
      <PrintNow />
      <h1 className="page-title">Peake Wörter</h1>
      <p className="mt-1 text-sm text-ink-2">
        Export vom {formatDate(exportedAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })} · {rows.length} Wörter · von{" "}
        {v?.name ?? "Gast"}
      </p>
      <ol className="mt-6">
        {rows.map((r) => (
          <li key={r.Wort} className="break-inside-avoid border-b border-line py-2">
            <p>
              <strong className="display text-lg">{r.Wort}</strong> {r.Lautschrift && <span className="font-lex text-ink-2">{r.Lautschrift}</span>}{" "}
              {r.Wortart && <em className="text-ink-2">{r.Wortart}</em>}
            </p>
            {r.Bedeutung && <p className="text-[0.95rem]">{r.Bedeutung}</p>}
            {r.Kategorien && <p className="text-xs text-ink-3">{r.Kategorien}</p>}
          </li>
        ))}
      </ol>
      <p className="mt-6 break-all font-mono text-[0.7rem] text-ink-3">Signatur (HMAC-SHA256): {signature}</p>
    </div>
  );
}
