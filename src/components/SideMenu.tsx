import Link from "next/link";
import { Menu } from "lucide-react";

export type MenuItem = { href: string; label: string; badge?: number };

/** Secondary destinations (games, Wort des Jahres, export …) in a native popover. */
export function SideMenu({ items }: { items: MenuItem[] }) {
  const unread = items.reduce((n, i) => n + (i.badge ?? 0), 0);
  return (
    <>
      <button
        type="button"
        popoverTarget="seitenmenue"
        className="relative grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-table-2 hover:text-ink"
        aria-label={`Menü${unread ? `, ${unread} neu` : ""}`}
      >
        <Menu size={20} strokeWidth={2.2} aria-hidden />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-no ring-2 ring-table" aria-hidden />}
      </button>
      <nav
        id="seitenmenue"
        popover="auto"
        aria-label="Weitere Bereiche"
        className="side-menu m-0 ml-auto h-dvh max-h-none w-[min(20rem,85vw)] border-l border-line bg-table p-0 text-ink"
      >
        <div className="pt-safe flex h-full flex-col overflow-y-auto px-3 pb-8">
          <p className="section-title px-3 pb-3 pt-6">Mehr</p>
          <ul>
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="flex min-h-12 items-center justify-between rounded-xl px-3 font-semibold hover:bg-table-2">
                  {i.label}
                  {i.badge ? <span className="tabular rounded-full bg-ink px-2 text-sm text-table">{i.badge}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
