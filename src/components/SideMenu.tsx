"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Menu } from "lucide-react";

export type MenuItem = { href: string; label: string; badge?: number };

/**
 * Secondary destinations (games, Wort des Jahres, export …) in a native popover.
 * Manual popover with its own backdrop: a tap outside only closes the menu and
 * never reaches the element underneath (light dismiss would let it through).
 */
export function SideMenu({ items }: { items: MenuItem[] }) {
  const unread = items.reduce((n, i) => n + (i.badge ?? 0), 0);
  const menu = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = menu.current!;
    const sync = () => setOpen(el.matches(":popover-open"));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && el.hidePopover();
    el.addEventListener("toggle", sync);
    document.addEventListener("keydown", esc);
    return () => {
      el.removeEventListener("toggle", sync);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  const close = () => menu.current?.hidePopover();

  return (
    <>
      <button
        type="button"
        popoverTarget="seitenmenue"
        aria-expanded={open}
        className="relative grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-table-2 hover:text-ink"
        aria-label={`Menü${unread ? `, ${unread} neu` : ""}`}
      >
        <Menu size={20} strokeWidth={2.2} aria-hidden />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-no ring-2 ring-table" aria-hidden />}
      </button>
      {/* Portal: the blurred header would otherwise be the containing block of `fixed`.
          Sits below the popover (top layer) and above everything else. */}
      {open && createPortal(<div aria-hidden className="fixed inset-0 z-[100] bg-black/40" onClick={close} />, document.body)}
      <nav
        ref={menu}
        id="seitenmenue"
        popover="manual"
        aria-label="Weitere Bereiche"
        className="side-menu m-0 ml-auto h-dvh max-h-none w-[min(20rem,85vw)] border-l border-line bg-table p-0 text-ink"
      >
        <div className="pt-safe flex h-full flex-col overflow-y-auto px-3 pb-8">
          <p className="section-title px-3 pb-3 pt-6">Mehr</p>
          <ul>
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} onClick={close} className="flex min-h-12 items-center justify-between rounded-xl px-3 font-semibold hover:bg-table-2">
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
