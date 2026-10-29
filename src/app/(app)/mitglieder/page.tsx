import Link from "next/link";
import type { Metadata } from "next";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/access";
import { formatDate } from "@/lib/time";
import { Avatar } from "@/components/Avatar";

export const metadata: Metadata = { title: "Mitglieder", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Mitglieder({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const v = await requireMemberPage();
  const q = (await searchParams).q?.trim().slice(0, 100) || undefined;
  // Small group: no pagination. Name and bio are searched; e-mail never.
  const users = await db.user.findMany({
    where: {
      disabled: false,
      ...(q && { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { bio: { contains: q, mode: "insensitive" as const } }] }),
    },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, avatarPath: true, bio: true, createdAt: true,
      curatorSeat: { select: { seat: true } },
      favoriteWord: { select: { term: true, isPublic: true } },
      _count: { select: { words: { where: { isPublic: true } } } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 md:px-6 md:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title">Mitglieder</h1>
        <p className="tabular text-sm text-ink-2">
          {users.length} {users.length === 1 ? "Person" : "Personen"}
        </p>
      </div>

      <form action="/mitglieder" role="search" className="mt-4 flex gap-2">
        <label htmlFor="suche" className="sr-only">
          Mitglieder suchen
        </label>
        <input id="suche" name="q" type="search" defaultValue={q} placeholder="Name oder Stichwort aus dem Profil" className="field" autoComplete="off" enterKeyHint="search" />
        <button className="btn btn-primary shrink-0 px-4" aria-label="Suchen">
          <Search size={20} strokeWidth={2.4} aria-hidden />
        </button>
      </form>

      {users.length === 0 ? (
        <p className="mt-10 text-ink-2">
          Niemand gefunden für „{q}“.{" "}
          <Link href="/mitglieder" className="font-semibold text-ink underline">
            Alle anzeigen
          </Link>
        </p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {users.map((u) => (
            <li key={u.id}>
              <Link href={`/profil/${u.id}`} className="group flex h-full items-start gap-4 rounded-[20px] border-[1.5px] border-line p-4 transition-colors hover:border-ink-3">
                <Avatar user={u} size={56} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-lg font-bold group-hover:underline">{u.name}</span>
                    {u.id === v.id && <span className="chip shrink-0 text-xs">Du</span>}
                  </span>
                  <span className="block text-sm text-ink-3">
                    {u.curatorSeat ? "Kurator" : "Mitglied"} seit {formatDate(u.createdAt, { month: "long", year: "numeric" })}
                  </span>
                  {u.bio && <span className="mt-1.5 line-clamp-2 block text-[0.95rem] text-ink-2">{u.bio}</span>}
                  <span className="mt-2 block text-sm text-ink-2">
                    <span className="tabular font-semibold text-ink">{u._count.words}</span> aufgenommen
                    {u.favoriteWord?.isPublic && (
                      <>
                        {" · Lieblingswort "}
                        <span className="font-semibold text-ink">{u.favoriteWord.term}</span>
                      </>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
