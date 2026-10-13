"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { setupCreateAdminAction, setupFinishAction, setupInviteAction, setupSettingsAction } from "@/app/actions/account";
import type { Settings } from "@/lib/settings";
import { FormError, Toggle, useFormAction } from "@/components/form";

export function AdminForm() {
  const router = useRouter();
  const [state, action, pending] = useFormAction(async (p: unknown, fd: FormData) => {
    const r = await setupCreateAdminAction(p, fd);
    if (r.ok) router.replace("/einrichtung?schritt=1");
    return r;
  });
  return (
    <form onSubmit={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="token" className="label">
          Setup-Token
        </label>
        <input id="token" name="token" required autoComplete="off" className="field font-mono" spellCheck={false} />
      </div>
      <div>
        <label htmlFor="name" className="label">
          Dein Name
        </label>
        <input id="name" name="name" required autoComplete="name" className="field" />
      </div>
      <div>
        <label htmlFor="email" className="label">
          E-Mail
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Passwort
        </label>
        <input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" className="field" />
        <p className="hint">Mindestens 12 Zeichen.</p>
      </div>
      <div>
        <label htmlFor="password2" className="label">
          Passwort wiederholen
        </label>
        <input id="password2" name="password2" type="password" required minLength={12} autoComplete="new-password" className="field" />
      </div>
      <Toggle name="asCurator" defaultChecked label="Ich bin Kurator (Platz 1)" />
      <FormError state={state} />
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" size={18} aria-hidden />} Konto anlegen
      </button>
    </form>
  );
}

export function InviteForm() {
  const [state, action, pending] = useFormAction(setupInviteAction);
  const [copied, setCopied] = useState(false);
  const link = state?.ok ? (state.data as { link: string }).link : null;
  if (link) {
    return (
      <div className="mt-6 rounded-2xl border-[1.5px] border-line p-5">
        <p className="font-bold">Einladungslink (7 Tage gültig, einmalig):</p>
        <p className="mt-2 break-all font-mono text-sm">{link}</p>
        <button
          type="button"
          className="btn btn-quiet btn-sm mt-4"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? "Kopiert" : "Link kopieren"}
        </button>
      </div>
    );
  }
  return (
    <form onSubmit={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="inv-email" className="label">
          E-Mail des zweiten Kurators <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <input id="inv-email" name="email" type="email" className="field" autoComplete="off" />
        <p className="hint">Bindet den Link an diese Adresse.</p>
      </div>
      <FormError state={state} />
      <button className="btn btn-primary" disabled={pending}>
        Einladungslink erstellen
      </button>
    </form>
  );
}

export function SettingsForm({ settings, next }: { settings: Settings; next?: string }) {
  const router = useRouter();
  const [state, action, pending] = useFormAction(async (p: unknown, fd: FormData) => {
    const r = await setupSettingsAction(p, fd);
    if (r.ok && next) router.push(next);
    return r;
  });
  return (
    <form onSubmit={action} className="mt-8 space-y-4">
      <PolicyFields settings={settings} />
      <FormError state={state} />
      <button className="btn btn-primary" disabled={pending}>
        Speichern und weiter
      </button>
    </form>
  );
}

export function PolicyFields({ settings }: { settings: Settings }) {
  return (
    <>
      <Toggle name="require2fa" defaultChecked={settings.require2fa} label="Zwei-Faktor-Code (TOTP) Pflicht" />
      <Toggle name="requirePasskey" defaultChecked={settings.requirePasskey} label="Passkey Pflicht" />
    </>
  );
}

export function FinishButton() {
  const router = useRouter();
  const [state, action, pending] = useFormAction(async () => {
    const r = await setupFinishAction();
    if (r.ok) router.replace("/k");
    return r;
  });
  return (
    <form onSubmit={action} className="mt-8">
      <FormError state={state} />
      <button className="btn btn-primary" disabled={pending}>
        Einrichtung abschließen
      </button>
    </form>
  );
}
