"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

// Shown to admins when the last export is over 30 days old. "Später" hides it for the rest of the month.
const KEY = "peake-backup-reminder";
const month = () => new Date().toISOString().slice(0, 7);

export function BackupReminder() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== month());
    } catch {
      setShow(true);
    }
  }, []);
  const hide = () => {
    try {
      localStorage.setItem(KEY, month());
    } catch {}
    setShow(false);
  };
  if (!show) return null;
  return (
    <>
    {/* Lets the end of the page scroll above the fixed reminder, so no button stays covered. */}
    <div aria-hidden className="h-24" />
    <aside
      aria-label="Backup-Erinnerung"
      className="toast-in fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-table shadow-lg md:bottom-8"
    >
      <span className="text-[0.95rem] font-semibold">Hast du diesen Monat schon ein Backup gemacht?</span>
      <span className="flex shrink-0 items-center gap-1">
        <Link href="/admin/export" onClick={hide} className="inline-flex h-10 items-center rounded-full px-3 font-bold underline-offset-2 hover:underline">
          Exportieren
        </Link>
        <button type="button" onClick={hide} className="grid size-10 place-items-center rounded-full opacity-70 hover:opacity-100" aria-label="Später erinnern">
          <X size={18} aria-hidden />
        </button>
      </span>
    </aside>
    </>
  );
}
