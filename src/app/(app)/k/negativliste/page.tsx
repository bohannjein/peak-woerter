import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/access";
import { formatDate } from "@/lib/time";
import { ActionButton } from "@/components/ActionButton";
import { openRoundAction } from "@/app/actions/words";

export const metadata: Metadata = { title: "Negativliste", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Negativliste() {
  await requireStaffPage();
  const words = await db.word.findMany({
    where: { status: "REJECTED" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, term: true, updatedAt: true, _count: { select: { rounds: true } } },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Negativliste</h1>
      {words.length === 0 ? (
        <p className="mt-12 text-lg text-ink-3">Leer.</p>
      ) : (
        <ul className="mt-8">
          {words.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-4">
              <span>
                <Link href={`/k/wort/${w.id}`} className="display text-[1.75rem] hover:underline">
                  {w.term}
                </Link>
                <span className="block text-sm text-ink-3">
                  abgelehnt {formatDate(w.updatedAt)} · {w._count.rounds} {w._count.rounds === 1 ? "Runde" : "Runden"}
                </span>
              </span>
              <ActionButton action={openRoundAction.bind(null, w.id, "REVOTE", "Erneute Prüfung von der Negativliste")} confirm={`„${w.term}“ erneut zur Abstimmung stellen?`}>
                Erneut prüfen
              </ActionButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
