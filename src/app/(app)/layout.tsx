import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { Wordmark } from "@/components/Wordmark";
import { NavBar, TabBar, type NavItem } from "@/components/NavBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { InstallSw } from "@/components/InstallSw";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings(db)]);
  if (!settings.setupCompleted && !viewer?.isAdmin) redirect("/einrichtung");
  // Internal archive: nothing is visible without an account.
  if (!viewer) redirect("/anmelden");
  const path = (await headers()).get("x-pathname") ?? "/";
  if (viewer.missing.length && path !== "/konto") redirect("/konto?pflicht=1");

  let items: NavItem[];
  if (viewer.seat) {
    const open = await db.votingRound.count({ where: { closedAt: null, votes: { none: { seat: viewer.seat } } } });
    items = [
      { href: "/woerter", label: "Sammlung", icon: "BookOpen" },
      { href: "/k/abstimmen", label: "Abstimmen", icon: "Layers", badge: open },
      { href: "/k/neu", label: "Hinzufügen", icon: "Plus", primary: true },
      { href: "/k/spaeter", label: "Später", icon: "Hourglass" },
      // Profil = personal overview (dashboard, account, admin links).
      { href: "/k", label: "Profil", icon: "User", exact: true },
    ];
  } else if (viewer.isAdmin) {
    items = [
      { href: "/woerter", label: "Sammlung", icon: "BookOpen" },
      { href: "/admin", label: "Verwaltung", icon: "User" },
    ];
  } else {
    // Member without vote: read only.
    items = [
      { href: "/", label: "Start", icon: "Home" },
      { href: "/woerter", label: "Sammlung", icon: "BookOpen" },
      { href: "/zufall", label: "Zufall", icon: "Shuffle" },
      { href: "/konto", label: "Profil", icon: "User" },
    ];
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <a href="#inhalt" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-primary">
        Zum Inhalt springen
      </a>
      <header className="pt-safe sticky top-0 z-30 bg-table/90 backdrop-blur-sm border-b border-line/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Wordmark />
          <NavBar items={items} />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/konto" className="btn btn-quiet btn-sm hidden md:inline-flex">
              {viewer.name.split(" ")[0]}
            </Link>
          </div>
        </div>
      </header>
      <main id="inhalt" className="flex-1 pb-28 md:pb-16">
        {children}
      </main>
      <TabBar items={items} />
      <InstallSw />
    </div>
  );
}
