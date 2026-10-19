"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { changeEmailAction, updateProfileAction } from "@/app/actions/member";
import { FormError, FormOk, useFormAction } from "./form";
import { Avatar } from "./Avatar";

export function ProfileForm({ user }: { user: { id: string; name: string; bio: string | null; avatarPath: string | null } }) {
  const [state, action, pending] = useFormAction(updateProfileAction);
  return (
    <div className="space-y-6">
      <AvatarUpload user={user} />
      <form onSubmit={action} className="space-y-4">
        <div>
          <label htmlFor="p-name" className="label">
            Name
          </label>
          <input id="p-name" name="name" defaultValue={user.name} required maxLength={60} className="field" autoComplete="nickname" />
        </div>
        <div>
          <label htmlFor="p-bio" className="label">
            Bio <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <textarea id="p-bio" name="bio" defaultValue={user.bio ?? ""} maxLength={500} rows={3} className="field resize-y" />
        </div>
        <FormError state={state} />
        <FormOk state={state} text="Gespeichert." />
        <button className="btn btn-primary" disabled={pending}>
          Speichern
        </button>
      </form>
    </div>
  );
}

function AvatarUpload({ user }: { user: { id: string; name: string; avatarPath: string | null } }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = (method: "PUT" | "DELETE", body?: File) =>
    start(async () => {
      const r = await fetch(`/api/avatar/${user.id}`, { method, body });
      setErr(r.ok ? null : ((await r.json().catch(() => null))?.error ?? "Hochladen fehlgeschlagen."));
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar user={user} size={72} />
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Profilbild wählen"
        onChange={(e) => e.target.files?.[0] && send("PUT", e.target.files[0])}
      />
      <button type="button" className="btn btn-quiet btn-sm" disabled={pending} onClick={() => input.current?.click()}>
        {pending ? <Loader2 className="animate-spin" size={17} aria-hidden /> : <ImageUp size={17} aria-hidden />} Profilbild wählen
      </button>
      {user.avatarPath && (
        <button type="button" className="btn btn-quiet btn-sm" disabled={pending} onClick={() => send("DELETE")}>
          <Trash2 size={17} aria-hidden /> Entfernen
        </button>
      )}
      {err && (
        <p role="alert" className="w-full text-sm font-semibold text-no">
          {err}
        </p>
      )}
    </div>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useFormAction(changeEmailAction);
  return (
    <form onSubmit={action} className="space-y-4">
      <div>
        <label htmlFor="e-mail" className="label">
          Neue E-Mail-Adresse
        </label>
        <input id="e-mail" name="email" type="email" defaultValue={email} required className="field" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="e-pw" className="label">
          Aktuelles Passwort
        </label>
        <input id="e-pw" name="password" type="password" required className="field" autoComplete="current-password" />
      </div>
      <FormError state={state} />
      <FormOk state={state} text="E-Mail-Adresse geändert. Ab jetzt damit anmelden." />
      <button className="btn btn-primary" disabled={pending}>
        E-Mail ändern
      </button>
    </form>
  );
}
