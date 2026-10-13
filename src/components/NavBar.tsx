"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Layers, Plus, Hourglass, User, Home, Shuffle, Lightbulb } from "lucide-react";

const icons = { BookOpen, Layers, Plus, Hourglass, User, Home, Shuffle, Lightbulb };
export type NavItem = { href: string; label: string; icon: keyof typeof icons; badge?: number; primary?: boolean; exact?: boolean };

function isActive(path: string, item: NavItem) {
  if (item.exact || item.href === "/") return path === item.href || (item.href === "/k" && path === "/konto");
  return path === item.href || path.startsWith(item.href + "/");
}

/** Inline bar in the header on wide screens. */
export function NavBar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
      <nav aria-label="Hauptnavigation" className="hidden md:flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(path, item);
          const Icon = icons[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative inline-flex items-center gap-2 h-10 px-3.5 rounded-full font-semibold text-[0.95rem] transition-colors ${
                active ? "bg-ink text-table" : "text-ink-2 hover:text-ink hover:bg-table-2"
              }`}
            >
              <Icon size={18} strokeWidth={2.2} aria-hidden />
              {item.label}
              {item.badge ? <Badge n={item.badge} /> : null}
            </Link>
          );
        })}
      </nav>
  );
}

/**
 * Bottom tab bar on phones. Must live outside the (blurred) header:
 * backdrop-filter would turn the header into its containing block.
 */
export function TabBar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
      <nav
        aria-label="Hauptnavigation"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-line bg-table/95 backdrop-blur-sm pb-safe"
      >
        <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
          {items.map((item) => {
            const active = isActive(path, item);
            const Icon = icons[item.icon];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold ${
                    active ? "text-ink" : "text-ink-3"
                  }`}
                >
                  {item.primary ? (
                    <span className="grid size-11 place-items-center rounded-full bg-ink text-table -mt-1">
                      <Icon size={24} strokeWidth={2.6} aria-hidden />
                    </span>
                  ) : (
                    <Icon size={22} strokeWidth={active ? 2.6 : 2} aria-hidden />
                  )}
                  <span className={item.primary ? "sr-only" : ""}>{item.label}</span>
                  {item.badge ? (
                    <span className="absolute top-2 left-1/2 ml-2">
                      <Badge n={item.badge} />
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="tabular inline-grid min-w-5 h-5 place-items-center rounded-full bg-ink px-1 text-[0.7rem] font-bold text-table ring-2 ring-table">
      <span className="sr-only">, </span>
      {n > 99 ? "99+" : n}
      <span className="sr-only"> offen</span>
    </span>
  );
}
