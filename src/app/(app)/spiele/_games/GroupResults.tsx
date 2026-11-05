import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { GroupRow } from "@/lib/puzzles/group";

/**
 * Today's results of the group. Before you are done you only see who has
 * played; the results show once your own game is over.
 */
export function GroupResults({ rows, me, done }: { rows: GroupRow[]; me: string; done: boolean }) {
  const others = rows.filter((r) => r.user.id !== me);
  const finished = rows.filter((r) => r.finished);
  if (!others.length) return <p className="mt-12 border-t border-line pt-6 text-sm text-ink-3">Du bist heute die erste Person bei diesem Rätsel.</p>;

  if (!done) {
    const played = others.filter((r) => r.finished);
    return (
      <section aria-labelledby="gruppe" className="mt-12 border-t border-line pt-6">
        <h2 id="gruppe" className="font-bold">
          Die Gruppe heute
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          {played.length ? `${played.length} ${played.length === 1 ? "ist" : "sind"} schon fertig.` : "Noch niemand ist fertig."} Die Ergebnisse siehst du, wenn du durch bist.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Schon gespielt">
          {played.map((r) => (
            <li key={r.user.id} title={r.user.name}>
              <Avatar user={r.user} size={32} />
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-labelledby="gruppe" className="mt-12 border-t border-line pt-6">
      <h2 id="gruppe" className="font-bold">
        Die Gruppe heute
      </h2>
      <p className="tabular mt-1 text-sm text-ink-2">
        {finished.filter((r) => r.won).length} von {finished.length} gelöst
      </p>
      <ol className="mt-3 divide-y divide-line">
        {rows.map((r, i) => (
          <li key={r.user.id} className={`flex items-center gap-3 py-2.5 ${r.user.id === me ? "font-bold" : ""}`}>
            <span className="tabular w-5 text-right text-sm text-ink-3">{r.finished ? i + 1 : ""}</span>
            <Avatar user={r.user} size={32} />
            <Link href={`/profil/${r.user.id}`} className="min-w-0 flex-1 truncate hover:underline">
              {r.user.id === me ? "Du" : r.user.name}
            </Link>
            <span className={`tabular text-sm ${!r.finished ? "text-ink-3" : r.won ? "" : "text-ink-2"}`}>{r.label}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
