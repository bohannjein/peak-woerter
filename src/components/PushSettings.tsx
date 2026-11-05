"use client";

import { useState } from "react";
import { setPushKindAction } from "@/app/actions/push";
import { PUSH_KINDS, type PushKind } from "@/lib/pushKinds";
import { PushToggle } from "./PushToggle";

/** Settings: the browser switch plus one checkbox per kind (stored per account, so it applies to every browser). */
export function PushSettings({ off: initial, curator }: { off: string[]; curator: boolean }) {
  const [off, setOff] = useState(() => new Set(initial));
  const [error, setError] = useState<string | null>(null);
  const kinds = (Object.keys(PUSH_KINDS) as PushKind[]).filter((k) => curator || !("curator" in PUSH_KINDS[k]));

  const toggle = async (k: PushKind, on: boolean) => {
    setError(null);
    const before = off;
    const next = new Set(off);
    if (on) next.delete(k);
    else next.add(k);
    setOff(next);
    const r = await setPushKindAction(k, on);
    if (!r.ok) {
      setOff(before);
      setError(r.error);
    }
  };

  return (
    <div>
      <PushToggle variant="alle" />
      <fieldset className="mt-6">
        <legend className="font-bold">Worüber du Bescheid bekommst</legend>
        <p className="mt-1 text-sm text-ink-3">Gilt für alle deine Browser. In den Nachrichten steht alles trotzdem.</p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {kinds.map((k) => (
            <li key={k}>
              <label className="flex cursor-pointer items-start gap-3 py-3">
                <input type="checkbox" className="mt-1 size-5 accent-[var(--ink)]" checked={!off.has(k)} onChange={(e) => toggle(k, e.target.checked)} />
                <span>
                  <span className="block font-semibold">{PUSH_KINDS[k].label}</span>
                  <span className="block text-sm text-ink-2">{PUSH_KINDS[k].hint}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-no">
            {error}
          </p>
        )}
      </fieldset>
    </div>
  );
}
