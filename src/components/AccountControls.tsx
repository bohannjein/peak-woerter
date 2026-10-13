"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/actions/account";

export function MotionToggle() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      setReduced(localStorage.getItem("motion") === "reduce");
    } catch {}
  }, []);
  function toggle() {
    const next = !reduced;
    setReduced(next);
    try {
      if (next) {
        localStorage.setItem("motion", "reduce");
        document.documentElement.dataset.motion = "reduce";
      } else {
        localStorage.removeItem("motion");
        delete document.documentElement.dataset.motion;
      }
    } catch {}
  }
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border-[1.5px] border-line p-4">
      <span>
        <span className="block font-semibold">Animationen reduzieren</span>
      </span>
      <input type="checkbox" checked={reduced} onChange={toggle} className="peer sr-only" />
      <span
        aria-hidden
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-table-3 transition-colors after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-yes peer-checked:after:translate-x-5 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-focus"
      />
    </label>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-quiet"
      onClick={async () => {
        await signOutAction();
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut size={18} aria-hidden /> Abmelden
    </button>
  );
}
