import type { Metadata } from "next";
import { db } from "@/lib/db";
import { KIND_LABEL, STAGE_LABEL, stageOf } from "@/lib/elections";
import { berlinYear, toBerlinLocal } from "@/lib/time";
import { ActionButton } from "@/components/ActionButton";
import { deleteElectionAction } from "@/app/actions/elections";
import { ElectionForm } from "./form";

export const metadata: Metadata = { title: "Wort des Jahres", robots: { index: false } };
export const dynamic = "force-dynamic";

// Default schedule: December, ten days per stage.
const defaults = (year: number) => ({
  nominateFrom: `${year}-12-01T00:00`,
  shortlistFrom: `${year}-12-11T00:00`,
  finalFrom: `${year}-12-21T00:00`,
  endsAt: `${year}-12-31T18:00`,
  nominations: 3,
  shortlistVotes: 3,
  finalists: 5,
});

export default async function AdminWdJ() {
  const year = berlinYear(new Date());
  const elections = await db.election.findMany({ orderBy: [{ year: "desc" }, { kind: "asc" }], include: { winner: { select: { term: true } }, _count: { select: { votes: true } } } });
  const current = (kind: "JURY" | "COMMUNITY") => {
    const e = elections.find((x) => x.kind === kind && x.year === year);
    return e
      ? { ...e, nominateFrom: toBerlinLocal(e.nominateFrom), shortlistFrom: toBerlinLocal(e.shortlistFrom), finalFrom: toBerlinLocal(e.finalFrom), endsAt: toBerlinLocal(e.endsAt) }
      : defaults(year);
  };

  return (
    <div className="max-w-2xl space-y-14">
      <p className="text-ink-2">
        Runde 1: alle nominieren Wörter aus der Sammlung. Runde 2: alle nominierten Wörter, jeder vergibt Up- und Downvotes. Runde 3: die besten Wörter, je ein Up- und ein
        Downvote. Das Wort mit dem höchsten Score gewinnt und erscheint auf der Startseite.
      </p>
      {(["JURY", "COMMUNITY"] as const).map((kind) => (
        <section key={kind} aria-labelledby={`wdj-${kind}`}>
          <h2 id={`wdj-${kind}`} className="section-title">
            {KIND_LABEL[kind]} {year}
          </h2>
          <p className="mt-1 text-sm text-ink-2">{kind === "JURY" ? "Alle Konten stimmen ab." : "Konten und Gäste stimmen ab (Gastmodus muss an sein)."}</p>
          <ElectionForm kind={kind} year={year} values={current(kind)} />
        </section>
      ))}

      {elections.length > 0 && (
        <section aria-labelledby="alle">
          <h2 id="alle" className="section-title">
            Alle Wahlen
          </h2>
          <ul className="mt-4">
            {elections.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-3">
                <span>
                  <span className="font-semibold">
                    {KIND_LABEL[e.kind]} {e.year}
                  </span>{" "}
                  · {e.winner ? `Gewinner: ${e.winner.term}` : STAGE_LABEL[stageOf(e)]} · {e._count.votes} Stimmen
                </span>
                <ActionButton action={deleteElectionAction.bind(null, e.id)} confirm="Wahl mit allen Stimmen löschen?">
                  Löschen
                </ActionButton>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
