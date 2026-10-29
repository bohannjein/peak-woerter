import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, Settings } from "lucide-react";
import { getViewer } from "@/lib/access";
import { SecurityPanel, PasswordForm } from "@/components/SecurityPanel";
import { MotionToggle, SignOutButton } from "@/components/AccountControls";
import { EmailForm, ProfileForm } from "@/components/ProfileForms";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Einstellungen", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Konto({ searchParams }: { searchParams: Promise<{ pflicht?: string; neu?: string }> }) {
  const v = await getViewer();
  if (!v) redirect("/anmelden");
  const sp = await searchParams;
  const me = await db.user.findUniqueOrThrow({ where: { id: v.id }, select: { id: true, name: true, bio: true, avatarPath: true } });

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <Link href={`/profil/${v.id}`} className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Profil
      </Link>
      <h1 className="page-title">Einstellungen</h1>
      <p className="mt-2 text-ink-2">
        {v.name} · {v.email}
        {v.seat ? ` · Kurator, Platz ${v.seat}` : ""}
        {v.isAdmin ? " · Administrator" : ""}
      </p>
      {v.isAdmin && v.missing.length === 0 && (
        <Link href="/admin" className="mt-6 flex items-center justify-between rounded-2xl border-[1.5px] border-line p-4 font-semibold transition-colors hover:border-ink-3">
          <span className="inline-flex items-center gap-2">
            <Settings size={18} aria-hidden /> Verwaltung
          </span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      )}

      {v.missing.length > 0 && (
        <div role="alert" className="mt-8 rounded-2xl border-[1.5px] border-later bg-later/15 p-5">
          <p className="font-bold">Pflicht: {v.missing.map((m) => (m === "2fa" ? "Zwei-Faktor-Code" : "Passkey")).join(" und ")} einrichten</p>
        </div>
      )}

      {v.missing.length === 0 && (
        <section id="profil" className="mt-12 scroll-mt-24" aria-labelledby="prof">
          <h2 id="prof" className="section-title mb-6">
            Profil
          </h2>
          <ProfileForm user={me} />
          <p className="mt-4 text-sm">
            <a href={`/profil/${v.id}`} className="font-semibold underline">
              So sehen andere dein Profil
            </a>
          </p>
        </section>
      )}

      <div className="mt-14 border-t border-line pt-10">
        <SecurityPanel has2fa={v.has2fa} required={v.missing} />
      </div>

      <section className="mt-14 border-t border-line pt-10" aria-labelledby="pw">
        <h2 id="pw" className="section-title mb-6">
          Passwort
        </h2>
        <PasswordForm />
      </section>

      <section className="mt-14 border-t border-line pt-10" aria-labelledby="mail">
        <h2 id="mail" className="section-title mb-6">
          Anmelde-E-Mail
        </h2>
        <EmailForm email={v.email} />
      </section>

      <section className="mt-14 border-t border-line pt-10" aria-labelledby="darstellung">
        <h2 id="darstellung" className="section-title mb-6">
          Darstellung
        </h2>
        <MotionToggle />
      </section>

      <div className="mt-14 border-t border-line pt-8">
        <SignOutButton />
      </div>
    </div>
  );
}
