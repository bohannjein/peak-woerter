"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

type Result = { ok: true; data?: unknown } | { ok: false; error: string };

/** Button that runs a (bound) server action and shows its error inline. */
export function ActionButton({
  action,
  children,
  className = "btn btn-quiet btn-sm",
  confirm: question,
  done,
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  done?: string;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (question && !window.confirm(question)) return;
            const r = await action();
            setMsg(r.ok ? (done ? { t: done, ok: true } : null) : { t: r.error, ok: false });
          })
        }
      >
        {pending && <Loader2 className="animate-spin" size={16} aria-hidden />}
        {children}
      </button>
      {msg && (
        <span role={msg.ok ? "status" : "alert"} className={`mt-1 text-sm font-semibold ${msg.ok ? "text-yes" : "text-no"}`}>
          {msg.t}
        </span>
      )}
    </span>
  );
}
