import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { ensureSetupToken, freeSeat } from "@/lib/accounts";
import { SecurityPanel } from "@/components/SecurityPanel";
import { AdminForm, FinishButton, InviteForm, SettingsForm } from "./forms";

export const metadata: Metadata = { title: "Ersteinrichtung", robots: { index: false } };
export const dynamic = "force-dynamic";

const STEPS = ["Konto", "Passkey & 2FA", "Kurator einladen", "Richtlinien", "Fertig"] as const;

export default async function Einrichtung({ searchParams }: { searchParams: Promise<{ schritt?: string }> }) {
  const settings = await getSettings(db);
  if (settings.setupCompleted) {
    return (
      <div>
        <h1 className="page-title">Schon eingerichtet.</h1>
        <p className="mt-3 text-ink-2">Die Einrichtung ist gesperrt.</p>
        <Link href="/anmelden" className="btn btn-primary mt-6">
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  const adminExists = (await db.user.count({ where: { isAdmin: true } })) > 0;
  const viewer = await getViewer();

  if (!adminExists) {
    await ensureSetupToken(db);
    return (
      <Shell step={0}>
        <h1 className="page-title">Willkommen.</h1>
        <p className="mt-3 text-ink-2">
          Setup-Token: Server-Log (<code className="font-mono text-sm">docker compose logs app</code>) oder <code className="font-mono text-sm">SETUP_TOKEN</code>.
        </p>
        <AdminForm />
      </Shell>
    );
  }

  if (!viewer?.isAdmin) {
    return (
      <div>
        <h1 className="page-title">Einrichtung läuft.</h1>
        <p className="mt-3 text-ink-2">Zum Fortsetzen anmelden.</p>
        <Link href="/anmelden" className="btn btn-primary mt-6">
          Anmelden
        </Link>
      </div>
    );
  }

  const step = Math.min(Math.max(Number((await searchParams).schritt) || 1, 1), 4);
  const seat = await freeSeat(db);

  return (
    <Shell step={step}>
      {step === 1 && (
        <>
          <h1 className="page-title">Konto absichern</h1>
          <div className="mt-8" />
          <SecurityPanel has2fa={viewer.has2fa} />
          <Next href="?schritt=2" />
        </>
      )}
      {step === 2 && (
        <>
          <h1 className="page-title">Kurator einladen</h1>
          <p className="mt-3 text-ink-2">
            {seat ? `Platz ${seat} ist frei.` : "Beide Plätze belegt."}
          </p>
          {seat && <InviteForm />}
          <Next href="?schritt=3" label={seat ? "Später einladen / weiter" : "Weiter"} />
        </>
      )}
      {step === 3 && (
        <>
          <h1 className="page-title">Richtlinien</h1>
          <SettingsForm settings={settings} next="?schritt=4" />
        </>
      )}
      {step === 4 && (
        <>
          <h1 className="page-title">Fertig.</h1>
          <p className="mt-3 text-ink-2">
            Danach ist die Einrichtung gesperrt.
          </p>
          <FinishButton />
        </>
      )}
    </Shell>
  );
}

function Shell({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div>
      <ol className="mb-10 flex gap-1.5" aria-label="Fortschritt">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
            <span className={`block h-1.5 rounded-full ${i <= step ? "bg-ink" : "bg-line"}`} />
            <span className={`mt-2 hidden text-xs font-semibold sm:block ${i === step ? "text-ink" : "text-ink-3"}`}>{s}</span>
          </li>
        ))}
      </ol>
      {children}
    </div>
  );
}

function Next({ href, label = "Weiter" }: { href: string; label?: string }) {
  return (
    <div className="mt-10 border-t border-line pt-6">
      <Link href={href} className="btn btn-primary">
        {label}
      </Link>
    </div>
  );
}
