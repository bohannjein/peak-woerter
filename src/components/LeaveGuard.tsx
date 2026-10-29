"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/time";

// Unsaved form input survives anything: it is written to localStorage while
// typing and when the tab is hidden, so a crash or closed tab loses nothing.
// Drafts live in this browser only.

type Stored<T> = { value: T; at: string };

const read = <T,>(key: string): Stored<T> | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Stored<T>) : null;
  } catch {
    return null;
  }
};

export function useDraft<T>(key: string, value: T, dirty: boolean) {
  const [found, setFound] = useState<Stored<T> | null>(null);
  const latest = useRef({ value, dirty });
  latest.current = { value, dirty };

  const write = useCallback(() => {
    try {
      if (latest.current.dirty) localStorage.setItem(key, JSON.stringify({ value: latest.current.value, at: new Date().toISOString() }));
    } catch {}
  }, [key]);
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {}
    setFound(null);
  }, [key]);

  useEffect(() => setFound(read<T>(key)), [key]);
  useEffect(() => {
    const t = setTimeout(write, 500);
    return () => clearTimeout(t);
  }, [value, dirty, write]);
  useEffect(() => {
    const now = () => document.visibilityState === "hidden" && write();
    document.addEventListener("visibilitychange", now);
    window.addEventListener("pagehide", write);
    return () => {
      document.removeEventListener("visibilitychange", now);
      window.removeEventListener("pagehide", write);
    };
  }, [write]);

  return { found, dismiss: () => setFound(null), clear, write };
}

/** Banner offering to restore a draft from an earlier visit. */
export function DraftBanner({ at, onRestore, onDiscard }: { at: string; onRestore: () => void; onDiscard: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[1.5px] border-later/60 bg-later/15 px-4 py-3">
      <span className="font-semibold">Ungespeicherter Entwurf vom {formatDate(at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
      <span className="flex gap-2">
        <button type="button" onClick={onRestore} className="btn btn-primary btn-sm">
          Wiederherstellen
        </button>
        <button type="button" onClick={onDiscard} className="btn btn-quiet btn-sm">
          Verwerfen
        </button>
      </span>
    </div>
  );
}

/** Asks before leaving with unsaved changes: keep draft, discard, or stay. */
export function LeaveGuard({ dirty, onKeep, onDiscard }: { dirty: boolean; onKeep: () => void; onDiscard: () => void }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    // Reload/close: browsers only allow their own generic prompt.
    const unload = (e: BeforeUnloadEvent) => {
      onKeep();
      e.preventDefault();
    };
    // In-app links: intercept before Next.js handles the click.
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.origin !== location.origin) return;
      if (a.pathname === location.pathname && a.search === location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget(a.pathname + a.search + a.hash);
      dialog.current?.showModal();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, onKeep]);

  const leave = (keep: boolean) => {
    if (keep) onKeep();
    else onDiscard();
    dialog.current?.close();
    if (target) router.push(target);
  };

  return (
    <dialog ref={dialog} className="m-auto max-w-sm rounded-[20px] bg-table p-6 text-ink shadow-xl backdrop:bg-black/40">
      <p className="text-lg font-bold">Ungespeicherte Änderungen</p>
      <p className="mt-2 text-ink-2">Du hast noch nicht gespeichert. Den Entwurf auf diesem Gerät behalten oder verwerfen?</p>
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" onClick={() => leave(true)} className="btn btn-primary">
          Entwurf behalten und verlassen
        </button>
        <button type="button" onClick={() => leave(false)} className="btn btn-quiet">
          Verwerfen und verlassen
        </button>
        <button type="button" onClick={() => dialog.current?.close()} className="btn btn-quiet">
          Weiter bearbeiten
        </button>
      </div>
    </dialog>
  );
}
