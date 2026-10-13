import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/access";
import { SecurityPanel, PasswordForm } from "@/components/SecurityPanel";
import { MotionToggle, SignOutButton } from "@/components/AccountControls";

export const metadata: Metadata = { title: "Konto", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Konto({ searchParams }: { searchParams: Promise<{ pflicht?: string; neu?: string }> }) {
  const v = await getViewer();
  if (!v) redirect("/anmelden");
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-10">
      <h1 className="page-title">Konto</h1>
      <p className="mt-2 text-ink-2">
        {v.name} · {v.email}
        {v.seat ? ` · Kurator, Platz ${v.seat}` : ""}
        {v.isAdmin ? " · Administrator" : ""}
      </p>

      {v.missing.length > 0 && (
        <div role="alert" className="mt-8 rounded-2xl border-[1.5px] border-later bg-later/15 p-5">
          <p className="font-bold">Pflicht: {v.missing.map((m) => (m === "2fa" ? "Zwei-Faktor-Code" : "Passkey")).join(" und ")} einrichten</p>
        </div>
      )}

      <div className="mt-12">
        <SecurityPanel has2fa={v.has2fa} required={v.missing} />
      </div>

      <section className="mt-14 border-t border-line pt-10" aria-labelledby="pw">
        <h2 id="pw" className="section-title mb-6">
          Passwort
        </h2>
        <PasswordForm />
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
