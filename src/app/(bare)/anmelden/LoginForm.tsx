"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { authClient, authError } from "@/lib/auth-client";

export function LoginForm({ guestOpen, guestInvalid }: { guestOpen: boolean; guestInvalid: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "totp" | "backup">("credentials");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const done = () => {
    router.replace("/k");
    router.refresh();
  };

  async function onCredentials(fd: FormData) {
    await run(async () => {
      const { data, error } = await authClient.signIn.email({
        email: String(fd.get("email")),
        password: String(fd.get("password")),
      });
      if (error) return setError(authError(error));
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return setStep("totp");
      done();
    });
  }

  async function onCode(fd: FormData) {
    await run(async () => {
      const code = String(fd.get("code")).replace(/\s/g, "");
      const trustDevice = fd.get("trust") === "on";
      const { error } =
        step === "totp"
          ? await authClient.twoFactor.verifyTotp({ code, trustDevice })
          : await authClient.twoFactor.verifyBackupCode({ code, trustDevice });
      if (error) return setError(authError(error));
      done();
    });
  }

  async function onPasskey() {
    await run(async () => {
      const res = await authClient.signIn.passkey();
      if (res?.error) return setError("code" in res.error && res.error.code === "AUTH_CANCELLED" ? null : authError(res.error));
      done();
    });
  }

  return (
    <div>
      <h1 className="page-title">{step === "credentials" ? "Anmelden" : "Zweiter Faktor"}</h1>

      {guestInvalid && !error && (
        <p role="alert" className="mt-6 rounded-xl border-[1.5px] border-no/60 bg-no/10 px-4 py-3 font-medium">
          Der Gastlink ist ungültig, abgelaufen oder schon benutzt.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-6 rounded-xl border-[1.5px] border-no/60 bg-no/10 px-4 py-3 font-medium">
          {error}
        </p>
      )}

      {step === "credentials" ? (
        <>
          <form action={onCredentials} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="label">
                E-Mail
              </label>
              <input id="email" name="email" type="email" required autoComplete="username webauthn" className="field" inputMode="email" />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Passwort
              </label>
              <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
            </div>
            <button className="btn btn-primary w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" size={18} aria-hidden />} Anmelden
            </button>
          </form>
          <div className="my-6 flex items-center gap-3 text-sm text-ink-3" aria-hidden>
            <span className="h-px flex-1 bg-line" /> oder <span className="h-px flex-1 bg-line" />
          </div>
          <button type="button" onClick={onPasskey} className="btn btn-quiet w-full" disabled={busy}>
            <KeyRound size={18} aria-hidden /> Mit Passkey anmelden
          </button>
          {guestOpen && (
            <a href="/gast" className="btn btn-quiet mt-3 w-full">
              Ohne Konto als Gast ansehen
            </a>
          )}
        </>
      ) : (
        <form action={onCode} className="mt-8 space-y-5" key={step}>
          <div>
            <label htmlFor="code" className="label">
              {step === "totp" ? "Code aus der Authenticator-App" : "Wiederherstellungscode"}
            </label>
            <input
              id="code"
              name="code"
              required
              autoFocus
              autoComplete="one-time-code"
              inputMode={step === "totp" ? "numeric" : "text"}
              pattern={step === "totp" ? "[0-9 ]{6,7}" : undefined}
              className="field tabular text-center text-2xl tracking-[0.3em]"
            />
          </div>
          <label className="flex items-center gap-3 text-[0.95rem]">
            <input type="checkbox" name="trust" className="size-5 accent-[var(--ink)]" /> Diesem Gerät 30 Tage vertrauen
          </label>
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" size={18} aria-hidden />} Bestätigen
          </button>
          <button type="button" className="w-full text-sm font-semibold text-ink-2 underline" onClick={() => setStep(step === "totp" ? "backup" : "totp")}>
            {step === "totp" ? "Wiederherstellungscode verwenden" : "Code aus der App verwenden"}
          </button>
        </form>
      )}
    </div>
  );
}
