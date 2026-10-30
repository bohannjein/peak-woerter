"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Search field that narrows the list while typing (updates ?q=, keeps the other filters). */
export function LiveSearch({ initial }: { initial?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(initial ?? "");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (q.trim() === (params.get("q") ?? "")) return; // URL already matches (first render, Enter)
    const t = setTimeout(() => {
      const p = new URLSearchParams(params.toString());
      if (q.trim()) p.set("q", q.trim());
      else p.delete("q");
      const s = p.toString();
      startTransition(() => router.replace(s ? `${path}?${s}` : path, { scroll: false }));
    }, 200);
    return () => clearTimeout(t);
  }, [q, params, path, router]);

  return (
    <input
      id="suche"
      name="q"
      type="search"
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Suchen"
      className="field"
      autoComplete="off"
      enterKeyHint="search"
    />
  );
}
