import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSettings, guestOpenNow } from "@/lib/settings";
import { formatDate, toBerlinLocal } from "@/lib/time";
import { ActionButton } from "@/components/ActionButton";
import { endGuestSessionsAction, revokeGuestLinkAction } from "@/app/actions/admin";
import { GuestLinkForm, GuestModeForm } from "./forms";

export const metadata: Metadata = { title: "Gäste", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Gaeste() {
  const now = new Date();
  const [s, links, sessions] = await Promise.all([
    getSettings(db),
    db.guestAccess.findMany({ where: { revokedAt: null, expiresAt: { gt: now }, usedAt: null }, orderBy: { createdAt: "desc" }, include: { _count: { select: { sessions: true } } } }),
    db.guestSession.count({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
  ]);
  const open = s.guestOpenUntil === "immer" ? "immer" : s.guestOpenUntil ? "bis" : "aus";

  return (
    <div className="max-w-2xl space-y-14">
      <section aria-labelledby="modus">
        <h2 id="modus" className="section-title">
          Gastmodus
        </h2>
        <p className="mt-2 text-ink-2">
          Gäste sehen nur die Sammlung (Wörter, Bedeutungen, bestätigte Lautschrift), können exportieren und beim Community-Wort des Jahres abstimmen. Keine Namen, keine
          Stimmen, keine Negativliste.
        </p>
        <p className="mt-3 font-semibold">
          Status: {!s.guestEnabled ? "aus" : guestOpenNow(s) ? (s.guestOpenUntil === "immer" ? "offen für alle" : `offen für alle bis ${formatDate(s.guestOpenUntil, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`) : "nur mit Gastlink"} ·{" "}
          {sessions} aktive Gastzugänge
        </p>
        <GuestModeForm enabled={s.guestEnabled} open={open} until={s.guestOpenUntil && s.guestOpenUntil !== "immer" ? toBerlinLocal(new Date(s.guestOpenUntil)) : ""} />
        {sessions > 0 && (
          <div className="mt-4">
            <ActionButton action={endGuestSessionsAction} confirm="Alle Gäste abmelden?" done="Alle Gäste abgemeldet.">
              Alle Gäste abmelden
            </ActionButton>
          </div>
        )}
      </section>

      <section aria-labelledby="links">
        <h2 id="links" className="section-title">
          Gastlinks
        </h2>
        {links.length > 0 && (
          <ul className="mt-4">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-3">
                <span>
                  <span className="font-semibold">{l.label ?? "ohne Namen"}</span> · {l.singleUse ? "einmalig" : `${l._count.sessions}× benutzt`}
                  <span className="block text-sm text-ink-3">gültig bis {formatDate(l.expiresAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </span>
                <ActionButton action={revokeGuestLinkAction.bind(null, l.id)}>Widerrufen</ActionButton>
              </li>
            ))}
          </ul>
        )}
        {s.guestEnabled ? <GuestLinkForm /> : <p className="mt-4 text-ink-3">Erst den Gastmodus einschalten.</p>}
      </section>
    </div>
  );
}
