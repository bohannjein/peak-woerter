import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Pencil, Settings as SettingsIcon, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/access";
import { computeUserStats, type PrivateStats } from "@/lib/userStats";
import { publicEntrySelect, publicWhere } from "@/lib/queries";
import { sfwOn } from "@/lib/sfw";
import { formatDate } from "@/lib/time";
import { Avatar } from "@/components/Avatar";
import { MiniCard } from "@/components/WordCard";

export const metadata: Metadata = { title: "Profil", robots: { index: false } };
export const dynamic = "force-dynamic";

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: "UTC" });

function Stat({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="text-sm text-ink-3">{k}</dt>
      <dd className="display tabular mt-1 text-2xl">{children}</dd>
    </div>
  );
}

function duration(min: number) {
  if (min < 60) return `${min} Min.`;
  if (min < 48 * 60) return `${Math.round(min / 60)} Std.`;
  return `${Math.round(min / 1440)} Tage`;
}

/** Active days per month as thin bars on a shared baseline; one series, so no legend. */
function MonthBars({ months }: { months: PrivateStats["months"] }) {
  const max = Math.max(1, ...months.map((m) => m.days));
  return (
    <figure className="mt-8">
      <figcaption className="text-sm text-ink-3">Aktive Tage pro Monat</figcaption>
      <div className="mt-3 flex h-28 items-end gap-[2px] border-b border-line" aria-hidden>
        {months.map((m) => (
          <div key={m.month} className="group relative flex h-full flex-1 items-end justify-center">
            <div className="w-full max-w-6 rounded-t-[4px] bg-ink-2 transition-colors group-hover:bg-ink" style={{ height: `${(m.days / max) * 100}%`, minHeight: m.days ? 2 : 0 }} />
            <span className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-semibold text-table group-hover:block">
              {MONTH.format(new Date(`${m.month}-01`))}: {m.days} {m.days === 1 ? "Tag" : "Tage"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px] text-[0.7rem] text-ink-3" aria-hidden>
        {months.map((m, i) => (
          <span key={m.month} className="flex-1 text-center">
            {i % 3 === 0 || i === 11 ? MONTH.format(new Date(`${m.month}-01`)) : ""}
          </span>
        ))}
      </div>
      <ul className="sr-only">
        {months.map((m) => (
          <li key={m.month}>
            {MONTH.format(new Date(`${m.month}-01`))} {m.month.slice(0, 4)}: {m.days} aktive Tage
          </li>
        ))}
      </ul>
    </figure>
  );
}

export default async function Profil({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireMemberPage();
  const u = await db.user.findUnique({
    where: { id: (await params).id },
    select: {
      id: true, name: true, bio: true, avatarPath: true, createdAt: true, disabled: true,
      curatorSeat: { select: { seat: true } },
      favoriteWord: { select: { term: true, slug: true, isPublic: true } },
    },
  });
  if (!u || u.disabled) notFound();
  const own = u.id === v.id;
  const [{ public: s, private: p }, words] = await Promise.all([
    computeUserStats(db, u.id, { includePrivate: own }),
    // The person's words in the collection, newest first – the "posts" of the profile.
    db.word.findMany({ where: { ...publicWhere(await sfwOn()), submittedById: u.id }, select: publicEntrySelect, orderBy: { acceptedAt: "desc" } }),
  ]);
  const fav = u.favoriteWord?.isPublic ? u.favoriteWord : null;
  const counts: [number, string][] = [
    [words.length, words.length === 1 ? "Wort" : "Wörter"],
    [s.submitted, "eingereicht"],
    [s.gameWins, s.gameWins === 1 ? "Sieg" : "Siege"],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/mitglieder" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Alle Mitglieder
        </Link>
        {own && (
          <Link href="/konto" aria-label="Einstellungen" className="grid size-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-table-2 hover:text-ink">
            <SettingsIcon size={22} aria-hidden />
          </Link>
        )}
      </div>

      <header className="flex items-center gap-6 sm:gap-10">
        <Avatar user={u} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate">{u.name}</h1>
          <dl className="mt-3 flex gap-6 sm:gap-8">
            {counts.map(([n, label]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="text-sm text-ink-2">{label}</dt>
                <dd className="tabular text-xl font-bold">{n}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>
      <p className="mt-5 text-sm text-ink-3">
        {u.curatorSeat ? "Kurator" : "Mitglied"} seit {formatDate(u.createdAt, { month: "long", year: "numeric" })}
        {fav && (
          <>
            {" · Lieblingswort "}
            <Link href={`/wort/${fav.slug}`} className="font-semibold text-ink hover:underline">
              {fav.term}
            </Link>
          </>
        )}
      </p>
      {u.bio && <p className="mt-3 max-w-[40rem] whitespace-pre-line text-lg leading-relaxed">{u.bio}</p>}
      {own && (
        <Link href="/konto#profil" className="btn btn-quiet btn-sm mt-5">
          <Pencil size={17} aria-hidden /> Profil bearbeiten
        </Link>
      )}

      <section aria-labelledby="woerter" className="mt-10 border-t border-line pt-6">
        <h2 id="woerter" className="sr-only">
          Wörter von {u.name}
        </h2>
        {words.length === 0 ? (
          <p className="py-8 text-center text-ink-3">{own ? "Noch keins deiner Wörter ist in der Sammlung." : "Noch keine Wörter in der Sammlung."}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {words.map((w) => (
              <li key={w.id}>
                <Link href={`/wort/${w.slug}`} className="group block h-44 rounded-[20px]">
                  <MiniCard term={w.term} cardNumber={w.cardNumber} band={w.categories[0]?.category} definition={w.definitions[0]?.text} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="section-title mt-14">Statistik</h2>
      <dl className="mt-6 grid gap-6 sm:grid-cols-3">
        {s.acceptRate !== null && <Stat k="Aufnahmequote">{pct(s.acceptRate)}</Stat>}
        {s.highestCard && <Stat k="Höchste Kartennummer">№ {String(s.highestCard).padStart(3, "0")}</Stat>}
        {s.firstAccepted && (
          <Stat k="Erstes aufgenommenes Wort">
            <Link href={`/wort/${s.firstAccepted.slug}`} className="hover:underline">{s.firstAccepted.term}</Link>
          </Stat>
        )}
        {s.latestAccepted && s.latestAccepted.slug !== s.firstAccepted?.slug && (
          <Stat k="Neuestes aufgenommenes Wort">
            <Link href={`/wort/${s.latestAccepted.slug}`} className="hover:underline">{s.latestAccepted.term}</Link>
          </Stat>
        )}
        {s.topCategories.length > 0 && <Stat k="Lieblingskategorien">{s.topCategories.map((c) => c.name).join(", ")}</Stat>}
        <Stat k="Kommentare">{s.comments}</Stat>
        <Stat k="Minispiel">
          <span className="inline-flex items-center gap-2">
            {s.gameWins > 0 && <Trophy size={22} aria-hidden />} {s.gameWins} {s.gameWins === 1 ? "Sieg" : "Siege"}
          </span>
          <span className="block text-base text-ink-3">{s.gameEntries} Beiträge</span>
        </Stat>
        {s.yearWins.length > 0 && (
          <Stat k="Wort des Jahres">
            {s.yearWins.map((w) => (
              <Link key={`${w.kind}-${w.year}`} href={`/wort/${w.word.slug}`} className="block hover:underline">
                {w.word.term} <span className="text-base text-ink-3">({w.year}{w.kind === "COMMUNITY" ? ", Publikum" : ""})</span>
              </Link>
            ))}
          </Stat>
        )}
      </dl>

      {p && (
        <section aria-labelledby="privat" className="mt-14">
          <h2 id="privat" className="section-title flex items-center gap-2">
            <Lock size={18} aria-hidden /> Nur für dich
          </h2>
          <p className="mt-1 text-sm text-ink-3">Andere Mitglieder sehen diesen Abschnitt nicht.</p>
          <dl className="mt-6 grid gap-6 sm:grid-cols-3">
            {p.votes.total > 0 && (
              <>
                <Stat k="Stimmen">
                  {p.votes.total}
                  <span className="block text-base text-ink-3">
                    {p.votes.yes} Ja · {p.votes.no} Nein · {p.votes.later} Später
                  </span>
                </Stat>
                <Stat k="Trefferquote">
                  {pct(p.hitRate)}
                  <span className="block text-base text-ink-3">Stimme = Ergebnis</span>
                </Stat>
                {p.medianMinutesToVote !== null && <Stat k="Typische Zeit bis zur Stimme">{duration(p.medianMinutesToVote)}</Stat>}
              </>
            )}
            {p.openRounds !== null && <Stat k="Offen für dich">{p.openRounds}</Stat>}
            {(p.ownLater > 0 || p.ownRejected > 0) && (
              <Stat k="Eigene Einreichungen">
                {p.ownLater} Später
                <span className="block text-base text-ink-3">{p.ownRejected} Negativliste</span>
              </Stat>
            )}
            {p.roundsOpened > 0 && <Stat k="Runden gestartet">{p.roundsOpened}</Stat>}
            {p.edits > 0 && <Stat k="Einträge bearbeitet">{p.edits}</Stat>}
            {p.aiDrafts > 0 && <Stat k="KI-Entwürfe">{p.aiDrafts}</Stat>}
            {p.recordings > 0 && <Stat k="Aussprache aufgenommen">{p.recordings}</Stat>}
            {p.elections > 0 && <Stat k="Wort-des-Jahres-Wahlen">{p.elections}</Stat>}
            {p.gameVotes > 0 && <Stat k="Minispiel-Stimmen">{p.gameVotes}</Stat>}
            <Stat k="Aktive Tage">{p.activeDays}</Stat>
            {p.longestStreak > 1 && <Stat k="Längste Serie">{p.longestStreak} Tage</Stat>}
            {p.topWeekday && <Stat k="Aktivster Wochentag">{p.topWeekday}</Stat>}
            {p.lastLogin && (
              <Stat k="Letzte Anmeldung">
                <span className="text-xl">{formatDate(p.lastLogin, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </Stat>
            )}
          </dl>
          {p.activeDays > 0 && <MonthBars months={p.months} />}
        </section>
      )}

    </div>
  );
}
