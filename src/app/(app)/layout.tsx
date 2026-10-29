import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getGuest, getViewer } from "@/lib/access";
import { getSettings, guestOpenNow } from "@/lib/settings";
import { isGuestPath } from "@/lib/guests";
import { can } from "@/lib/permissions";
import { sfwOn } from "@/lib/sfw";
import { settleRounds } from "@/lib/voting";
import { unreadCount } from "@/lib/notifications";
import { berlinYear } from "@/lib/time";
import { Wordmark } from "@/components/Wordmark";
import { NavBar, TabBar, type NavItem } from "@/components/NavBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SfwToggle } from "@/components/SfwToggle";
import { SideMenu, type MenuItem } from "@/components/SideMenu";
import { InstallSw } from "@/components/InstallSw";
import { EasterEggs } from "@/components/EasterEggs";
import { BackupReminder } from "@/components/BackupReminder";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [viewer, settings] = await Promise.all([getViewer(), getSettings(db)]);
  if (!settings.setupCompleted && !viewer?.isAdmin) redirect("/einrichtung");
  const path = (await headers()).get("x-pathname") ?? "/";

  let items: NavItem[];
  let menu: MenuItem[];
  let name: string | null = null;
  let backupDue = false;
  if (!viewer) {
    // Internal archive: without an account only guests (if enabled) see anything.
    const guest = await getGuest();
    if (!guest) redirect(guestOpenNow(settings) ? `/gast?weiter=${encodeURIComponent(path)}` : "/anmelden");
    if (!isGuestPath(path)) redirect("/");
    items = [
      { href: "/", label: "Start", icon: "Home" },
      { href: "/woerter", label: "Sammlung", icon: "BookOpen" },
      { href: "/zufall", label: "Zufall", icon: "Shuffle" },
    ];
    menu = [
      { href: "/wort-des-jahres", label: "Wort des Jahres" },
      { href: "/export", label: "Liste exportieren" },
      { href: "/anmelden", label: "Anmelden" },
    ];
  } else {
    if (viewer.missing.length && path !== "/konto") redirect("/konto?pflicht=1");
    name = viewer.name.split(" ")[0];
    await settleRounds(db);
    const unread = await unreadCount(db, viewer.id);
    if (viewer.isAdmin) {
      // "export" = admin backups from before data.exported existed.
      const last = await db.auditLog.findFirst({ where: { action: { in: ["data.exported", "export"] } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      backupDue = !last || Date.now() - last.createdAt.getTime() > 30 * 86_400_000;
    }
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
      // Member without vote: read only (plus rights the admin granted).
      items = [
        { href: "/", label: "Start", icon: "Home" },
        { href: "/woerter", label: "Sammlung", icon: "BookOpen" },
        { href: "/zufall", label: "Zufall", icon: "Shuffle" },
        { href: "/konto", label: "Profil", icon: "User" },
      ];
    }
    menu = [
      { href: "/nachrichten", label: "Nachrichten", badge: unread },
      { href: "/spiele", label: "Minispiele" },
      { href: "/wort-des-jahres", label: "Wort des Jahres" },
      ...(can(viewer, "edit") || can(viewer, "tags") ? [{ href: "/pflege", label: "Datenbank pflegen" }] : []),
      ...(can(viewer, "tags") ? [{ href: "/k/kategorien", label: "Kategorien & Tags" }] : []),
      ...(can(viewer, "negative") ? [{ href: "/k/negativliste", label: "Negativliste" }] : []),
      { href: "/export", label: "Liste exportieren" },
      { href: `/wrapped/${berlinYear(new Date())}`, label: "Peake Wrapped" },
      { href: `/profil/${viewer.id}`, label: "Mein Profil" },
      { href: "/konto", label: "Konto & Sicherheit" },
      ...(viewer.isAdmin ? [{ href: "/admin", label: "Verwaltung" }] : []),
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
          <div className="flex items-center gap-0.5">
            <SfwToggle on={await sfwOn()} />
            <ThemeToggle />
            {name && (
              <Link href="/konto" className="btn btn-quiet btn-sm hidden lg:inline-flex">
                {name}
              </Link>
            )}
            <SideMenu items={menu} />
          </div>
        </div>
      </header>
      <main id="inhalt" className="flex-1 pb-28 md:pb-16">
        {children}
      </main>
      <TabBar items={items} />
      <InstallSw />
      <EasterEggs />
      {backupDue && <BackupReminder />}
    </div>
  );
}
