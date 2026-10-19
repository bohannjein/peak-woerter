import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { KIND_LABEL, STAGE_LABEL, decideElection, stageOf } from "@/lib/elections";

/** Start page: running vote (call to action) or the latest winners. */
export async function WordOfYear() {
  const viewer = await getViewer();
  const where = viewer ? {} : { kind: "COMMUNITY" as const };
  const latest = await db.election.findMany({ where, orderBy: { year: "desc" }, take: 2 });
  for (const e of latest) if (!e.decidedAt) await decideElection(db, e.id);

  const running = latest.find((e) => !e.decidedAt && stageOf(e) >= 1 && stageOf(e) <= 3);
  const winners = await db.election.findMany({
    where: { ...where, winnerWordId: { not: null }, year: latest[0]?.year },
    include: { winner: { select: { term: true, slug: true, isPublic: true } } },
    orderBy: { kind: "asc" },
  });
  if (!running && winners.length === 0) return null;

  return (
    <aside className="mt-8 flex flex-wrap gap-3" aria-label="Wort des Jahres">
      {running && (
        <Link href={running.kind === "COMMUNITY" && viewer ? "/wort-des-jahres?art=community" : "/wort-des-jahres"} className="chip">
          <Trophy size={16} aria-hidden /> {KIND_LABEL[running.kind]} {running.year}: {STAGE_LABEL[stageOf(running)]} <ArrowRight size={15} aria-hidden />
        </Link>
      )}
      {winners.map(
        (w) =>
          w.winner && (
            <Link key={w.id} href={w.winner.isPublic ? `/wort/${w.winner.slug}` : "/wort-des-jahres"} className="card-stock band-sun flex items-center gap-3 overflow-hidden pr-5">
              <span className="grid h-full place-items-center self-stretch px-3" style={{ background: "var(--band)", color: "var(--band-ink)" }}>
                <Trophy size={18} aria-hidden />
              </span>
              <span className="py-2">
                <span className="block text-xs font-bold uppercase tracking-wide text-[var(--card-ink-2)]">
                  {KIND_LABEL[w.kind]} {w.year}
                </span>
                <span className="display text-2xl text-[var(--card-ink)]">{w.winner.term}</span>
              </span>
            </Link>
          ),
      )}
    </aside>
  );
}
