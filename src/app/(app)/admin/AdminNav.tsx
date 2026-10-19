"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/admin", "System"],
  ["/admin/benutzer", "Benutzer"],
  ["/admin/einstellungen", "Abstimmung & Funktionen"],
  ["/admin/gaeste", "Gäste"],
  ["/admin/wort-des-jahres", "Wort des Jahres"],
  ["/admin/sicherheit", "Richtlinien"],
  ["/k/kategorien", "Kategorien"],
  ["/k/negativliste", "Negativliste"],
  ["/admin/ki", "KI"],
  ["/admin/export", "Export & Backup"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Verwaltung" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {ITEMS.map(([href, label]) => (
        <Link key={href} href={href} className="chip" aria-current={path === href ? "true" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
