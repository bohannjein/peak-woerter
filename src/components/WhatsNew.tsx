"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { markNewsSeenAction } from "@/app/actions/member";
import type { Release } from "@/lib/changelog";

/** Shown once after an update: the new entries; closing remembers the version. */
export function WhatsNewDialog({ releases }: { releases: Release[] }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    // Esc, the button and a tap outside all end here.
    const seen = () => void markNewsSeenAction();
    d.addEventListener("close", seen);
    return () => d.removeEventListener("close", seen);
  }, []);

  const close = () => dialog.current?.close();

  return (
    // Padding sits on the inner div, so only taps outside the box reach the dialog element.
    <dialog
      ref={dialog}
      aria-labelledby="neu-titel"
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto max-h-[85dvh] w-[min(30rem,calc(100vw-2rem))] rounded-[20px] bg-table p-0 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <p className="condensed text-sm font-extrabold uppercase tracking-[0.08em] text-ink-3">Update · v{releases[0].version}</p>
        <h2 id="neu-titel" className="display mt-1 text-[2rem]">
          Was ist neu
        </h2>
        <ReleaseList releases={releases} onNavigate={close} />
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/neuigkeiten" onClick={close} className="text-sm font-semibold text-ink-2 underline decoration-line hover:text-ink">
            Alle Versionen
          </Link>
          <button type="button" onClick={close} className="btn btn-primary" autoFocus>
            Alles klar
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function ReleaseList({ releases, onNavigate, showVersion = releases.length > 1 }: { releases: Release[]; onNavigate?: () => void; showVersion?: boolean }) {
  return (
    <div className="mt-4 space-y-6">
      {releases.map((r) => (
        <section key={r.version} aria-label={`Version ${r.version}`}>
          {showVersion && (
            <p className="tabular text-sm font-semibold text-ink-3">
              v{r.version} · {new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${r.date}T12:00:00Z`))}
            </p>
          )}
          <ul className="mt-2 space-y-4">
            {r.items.map((i) => (
              <li key={i.title} className="border-l-2 border-line pl-4">
                <p className="font-bold">
                  {i.href ? (
                    <Link href={i.href} onClick={onNavigate} className="hover:underline">
                      {i.title}
                    </Link>
                  ) : (
                    i.title
                  )}
                </p>
                <p className="mt-0.5 text-ink-2">{i.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
