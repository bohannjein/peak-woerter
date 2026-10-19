"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { EyeOff, Eye } from "lucide-react";

/** SFW mode lives in a cookie so server-rendered lists can filter by it. */
export function SfwToggle({ on }: { on: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const Icon = on ? EyeOff : Eye;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        document.cookie = on ? "sfw=; path=/; max-age=0; samesite=lax" : "sfw=1; path=/; max-age=31536000; samesite=lax";
        start(() => router.refresh());
      }}
      aria-pressed={on}
      className={`grid size-10 place-items-center rounded-full transition-colors hover:bg-table-2 ${on ? "text-ink" : "text-ink-2 hover:text-ink"}`}
      aria-label={on ? "SFW-Modus an: 18+-Wörter ausgeblendet. Ausschalten" : "SFW-Modus einschalten: 18+-Wörter ausblenden"}
      title={on ? "SFW an" : "SFW aus"}
    >
      <Icon size={19} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
