import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/time";
import { getSettings } from "@/lib/settings";
import pkg from "../../../../package.json";

export const metadata: Metadata = { title: "Verwaltung", robots: { index: false } };
export const dynamic = "force-dynamic";

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5">
      <dt className="text-ink-2">{k}</dt>
      <dd className="tabular text-right font-semibold">{v}</dd>
    </div>
  );
}

export default async function AdminHome() {
  const [counts, logs, settings, dbVersion, migrations] = await Promise.all([
    db.word.groupBy({ by: ["status"], _count: { _all: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } }),
    getSettings(db),
    db.$queryRaw<{ v: string }[]>`SHOW server_version`,
    db.$queryRaw<{ n: bigint; last: Date | null }[]>`SELECT count(*) AS n, max(finished_at) AS last FROM _prisma_migrations`,
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;

  return (
    <div className="grid gap-12 md:grid-cols-2">
      <section aria-labelledby="sys">
        <h2 id="sys" className="section-title mb-3">
          System
        </h2>
        <dl>
          <Fact k="Version" v={pkg.version} />
          <Fact k="Node.js" v={process.version} />
          <Fact k="PostgreSQL" v={dbVersion[0]?.v} />
          <Fact k="Migrationen" v={`${migrations[0]?.n ?? 0}${migrations[0]?.last ? ` · zuletzt ${formatDate(migrations[0].last)}` : ""}`} />
          <Fact k="Adresse" v={process.env.BETTER_AUTH_URL ?? "nicht gesetzt"} />
          <Fact k="KI" v={settings.aiProvider === "none" ? "aus" : settings.aiModel} />
        </dl>
      </section>
      <section aria-labelledby="bestand">
        <h2 id="bestand" className="section-title mb-3">
          Bestand
        </h2>
        <dl>
          <Fact k="Im Archiv" v={c("ACCEPTED")} />
          <Fact k="In Abstimmung" v={c("VOTING")} />
          <Fact k="Später" v={c("LATER")} />
          <Fact k="Negativliste" v={c("REJECTED")} />
        </dl>
      </section>
      <section aria-labelledby="proto" className="md:col-span-2">
        <h2 id="proto" className="section-title mb-3">
          Protokoll
        </h2>
        <ol className="text-[0.95rem]">
          {logs.map((l) => (
            <li key={l.id} className="grid grid-cols-[8.5rem_1fr] gap-3 border-t border-line py-2 md:grid-cols-[10rem_10rem_1fr]">
              <span className="tabular text-ink-3">{formatDate(l.createdAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="font-semibold">{l.actor?.name ?? "System"}</span>
              <span className="col-span-2 font-mono text-[0.85rem] text-ink-2 md:col-span-1">
                {l.action} {l.entityType}
                {l.entityId ? `:${l.entityId.slice(0, 8)}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
