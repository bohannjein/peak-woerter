import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { requireMemberPage } from "@/lib/access";
import { gameWins } from "@/lib/games";
import { formatDate } from "@/lib/time";
import { Avatar } from "@/components/Avatar";

export const metadata: Metadata = { title: "Profil", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Profil({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireMemberPage();
  const u = await db.user.findUnique({
    where: { id: (await params).id },
    select: {
      id: true, name: true, bio: true, avatarPath: true, createdAt: true, disabled: true,
      curatorSeat: { select: { seat: true } },
      favoriteWord: { select: { term: true, slug: true, isPublic: true } },
      _count: { select: { words: { where: { isPublic: true } } } },
    },
  });
  if (!u || u.disabled) notFound();
  const wins = await gameWins(db, u.id);
  const fav = u.favoriteWord?.isPublic ? u.favoriteWord : null;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <div className="flex items-center gap-5">
        <Avatar user={u} size={88} />
        <div>
          <h1 className="page-title">{u.name}</h1>
          <p className="mt-1 text-ink-2">
            {u.curatorSeat ? "Kurator" : "Mitglied"} seit {formatDate(u.createdAt, { month: "long", year: "numeric" })}
          </p>
        </div>
      </div>
      {u.bio && <p className="mt-6 max-w-[40rem] whitespace-pre-line text-lg leading-relaxed">{u.bio}</p>}

      <dl className="mt-10 grid gap-6 sm:grid-cols-3">
        <div className="border-t border-line pt-3">
          <dt className="text-sm text-ink-3">Lieblingswort</dt>
          <dd className="display mt-1 text-2xl">{fav ? <Link href={`/wort/${fav.slug}`} className="hover:underline">{fav.term}</Link> : <span className="text-ink-3">noch keins</span>}</dd>
        </div>
        <div className="border-t border-line pt-3">
          <dt className="text-sm text-ink-3">Eingereicht und aufgenommen</dt>
          <dd className="display tabular mt-1 text-2xl">{u._count.words}</dd>
        </div>
        <div className="border-t border-line pt-3">
          <dt className="text-sm text-ink-3">Minispiel-Siege</dt>
          <dd className="display tabular mt-1 inline-flex items-center gap-2 text-2xl">
            {wins > 0 && <Trophy size={22} aria-hidden />} {wins}
          </dd>
        </div>
      </dl>

      {u.id === v.id && (
        <Link href="/konto#profil" className="btn btn-quiet btn-sm mt-10">
          <Pencil size={17} aria-hidden /> Profil bearbeiten
        </Link>
      )}
    </div>
  );
}
