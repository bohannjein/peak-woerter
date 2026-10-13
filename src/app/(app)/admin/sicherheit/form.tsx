"use client";

import { updatePoliciesAction } from "@/app/actions/account";
import { PolicyFields } from "@/app/(bare)/einrichtung/forms";
import { FormError, FormOk, useFormAction } from "@/components/form";
import type { Settings } from "@/lib/settings";

export function PoliciesForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useFormAction(updatePoliciesAction);
  return (
    <form onSubmit={action} className="mt-6 space-y-4">
      <PolicyFields settings={settings} />
      <FormError state={state} />
      <FormOk state={state} text="Gespeichert." />
      <button className="btn btn-primary" disabled={pending}>
        Speichern
      </button>
    </form>
  );
}
