"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { inviteAction, resetLinkAction, setPermissionsAction } from "@/app/actions/admin";
import { PERMISSIONS, PERMISSION_KEYS } from "@/lib/permissions";
import { FormError, useFormAction } from "@/components/form";

export function CopyLink({ link, note }: { link: string; note: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-2xl border-[1.5px] border-line p-4">
      <p className="break-all font-mono text-sm">{link}</p>
      <button
        type="button"
        className="btn btn-quiet btn-sm mt-3"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        }}
      >
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? "Kopiert" : "Kopieren"}
      </button>
      <p className="hint">{note}</p>
    </div>
  );
}

export function ResetLinkButton({ userId }: { userId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="w-full sm:w-auto">
      <button
        type="button"
        className="btn btn-quiet btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await resetLinkAction(userId);
            if (r.ok) setLink((r.data as { link: string }).link);
            else setErr(r.error);
          })
        }
      >
        Passwort-Link
      </button>
      {err && <span className="ml-2 text-sm font-semibold text-no">{err}</span>}
      {link && <CopyLink link={link} note="24 h gültig, einmalig." />}
    </span>
  );
}

export function InviteCreate({ freeSeats }: { freeSeats: number[] }) {
  const [state, action, pending] = useFormAction(inviteAction);
  const link = state?.ok ? (state.data as { link: string }).link : null;
  return (
    <form onSubmit={action} className="mt-6 max-w-lg space-y-4 rounded-2xl border-[1.5px] border-line p-5">
      <p className="font-bold">Neue Einladung</p>
      <div>
        <label htmlFor="inv-seat" className="label">
          Kuratorenplatz
        </label>
        <select id="inv-seat" name="seat" className="field" defaultValue={freeSeats[0] ?? ""}>
          <option value="">keiner (nur lesen, kein Stimmrecht)</option>
          {freeSeats.map((s) => (
            <option key={s} value={s}>
              Platz {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="inv-mail" className="label">
          E-Mail <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <input id="inv-mail" name="email" type="email" className="field" />
      </div>
      <label className="flex items-center gap-3">
        <input type="checkbox" name="admin" className="size-5 accent-[var(--ink)]" /> Verwaltungsrechte geben
      </label>
      <FormError state={state} />
      <button className="btn btn-primary" disabled={pending}>
        Link erstellen
      </button>
      {link && <CopyLink link={link} note="7 Tage gültig, einmalig." />}
    </form>
  );
}

export function PermissionsForm({ userId, granted }: { userId: string; granted: string[] }) {
  const [state, action, pending] = useFormAction(setPermissionsAction.bind(null, userId));
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink-2 hover:text-ink">Rechte {granted.length > 0 && `(${granted.length})`}</summary>
      <form onSubmit={action} className="mt-3 space-y-2 rounded-2xl border-[1.5px] border-line p-4">
        {PERMISSION_KEYS.map((p) => (
          <label key={p} className="flex items-center gap-3">
            <input type="checkbox" name={p} defaultChecked={granted.includes(p)} className="size-5 accent-[var(--ink)]" /> {PERMISSIONS[p]}
          </label>
        ))}
        <FormError state={state} />
        <button className="btn btn-primary btn-sm mt-2" disabled={pending}>
          {state?.ok ? "Gespeichert" : "Speichern"}
        </button>
      </form>
    </details>
  );
}
