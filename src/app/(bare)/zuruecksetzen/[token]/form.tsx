"use client";

import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/account";
import { FormError, useFormAction } from "@/components/form";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useFormAction(resetPasswordAction.bind(null, token));
  if (state?.ok) {
    return (
      <div className="mt-8">
        <p role="status" className="font-semibold">Passwort gespeichert.</p>
        <Link href="/anmelden" className="btn btn-primary mt-4">
          Zur Anmeldung
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={action} className="mt-8 space-y-5">
      <div>
        <label htmlFor="password" className="label">
          Neues Passwort
        </label>
        <input id="password" name="password" type="password" required minLength={12} autoComplete="new-password" className="field" />
      </div>
      <div>
        <label htmlFor="password2" className="label">
          Wiederholen
        </label>
        <input id="password2" name="password2" type="password" required minLength={12} autoComplete="new-password" className="field" />
      </div>
      <FormError state={state} />
      <button className="btn btn-primary w-full" disabled={pending}>
        Passwort speichern
      </button>
    </form>
  );
}
