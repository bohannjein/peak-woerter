"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { acceptInviteAction } from "@/app/actions/account";
import { FormError, useFormAction } from "@/components/form";

export function InviteAcceptForm({ token, email }: { token: string; email: string | null }) {
  const router = useRouter();
  const [state, action, pending] = useFormAction(async (p: unknown, fd: FormData) => {
    const r = await acceptInviteAction(token, p, fd);
    if (r.ok) router.replace("/konto?neu=1");
    return r;
  });
  return (
    <form onSubmit={action} className="mt-8 space-y-5">
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
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email ?? ""} readOnly={!!email} className="field" />
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
      <FormError state={state} />
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" size={18} aria-hidden />} Konto anlegen
      </button>
    </form>
  );
}
