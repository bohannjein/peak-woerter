import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { formatDate } from "@/lib/time";
import { ActionButton } from "@/components/ActionButton";
import { assignSeatAction, freeSeatAction, reset2faAction, revokeInviteAction, setAdminAction, setDisabledAction } from "@/app/actions/admin";
import { InviteCreate, PermissionsForm, ResetLinkButton } from "./client";
import { getSettings } from "@/lib/settings";
import { seatNumbers } from "@/lib/accounts";

export const metadata: Metadata = { title: "Benutzer", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Benutzer() {
  const me = (await getViewer())!;
  const [users, invites, seats, settings] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" }, include: { curatorSeat: true, _count: { select: { passkeys: true, sessions: true } } } }),
    db.accessLink.findMany({ where: { kind: "INVITE", usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    db.curatorSeat.findMany(),
    getSettings(db),
  ]);
  const all = seatNumbers(settings.voterCount);
  const free = all.filter((s) => !seats.some((x) => x.seat === s));

  return (
    <div className="space-y-14">
      <section aria-labelledby="kur">
        <h2 id="kur" className="section-title">
          Kuratorenplätze
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {all.map((s) => {
            const seat = seats.find((x) => x.seat === s);
            const u = users.find((x) => x.id === seat?.userId);
            return (
              <li key={s} className="rounded-2xl border-[1.5px] border-line p-4">
                <p className="text-sm font-semibold text-ink-3">Platz {s}</p>
                <p className="display mt-1 text-3xl">{u?.name ?? "frei"}</p>
                {seat && (
                  <div className="mt-3">
                    <ActionButton action={freeSeatAction.bind(null, s)} confirm={`Platz ${s} freigeben? Die Person verliert das Stimmrecht; ihre bisherigen Stimmen bleiben im Verlauf.`}>
                      Stimmrecht entziehen
                    </ActionButton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="konten">
        <h2 id="konten" className="section-title">
          Konten
        </h2>
        <ul className="mt-4">
          {users.map((u) => (
            <li key={u.id} className="border-t border-line py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="text-lg font-bold">{u.name}</span>
                  {u.id === me.id && <span className="ml-2 text-sm text-ink-3">(du)</span>}
                  <span className="block text-sm text-ink-2">{u.email}</span>
                </span>
                <span className="flex flex-wrap gap-1.5 text-xs font-bold">
                  {u.curatorSeat && <span className="rounded-full bg-ink px-2 py-0.5 text-table">Kurator {u.curatorSeat.seat}</span>}
                  {u.isAdmin && <span className="rounded-full border-[1.5px] border-ink px-2 py-0.5">Admin</span>}
                  <span className={`rounded-full px-2 py-0.5 ${u.twoFactorEnabled ? "bg-yes text-white" : "bg-table-3"}`}>2FA {u.twoFactorEnabled ? "an" : "aus"}</span>
                  <span className="rounded-full bg-table-3 px-2 py-0.5">{u._count.passkeys} Passkey{u._count.passkeys === 1 ? "" : "s"}</span>
                  {u.disabled && <span className="rounded-full bg-no px-2 py-0.5 text-white">gesperrt</span>}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ResetLinkButton userId={u.id} />
                {u.twoFactorEnabled && (
                  <ActionButton action={reset2faAction.bind(null, u.id)} confirm={`2FA von ${u.name} zurücksetzen?`} done="2FA entfernt.">
                    2FA zurücksetzen
                  </ActionButton>
                )}
                {!u.curatorSeat && free[0] && (
                  <ActionButton action={assignSeatAction.bind(null, u.id, free[0])}>Stimmrecht geben (Platz {free[0]})</ActionButton>
                )}
                {u.id !== me.id && (
                  <ActionButton action={setAdminAction.bind(null, u.id, !u.isAdmin)} confirm={u.isAdmin ? `${u.name} die Verwaltungsrechte entziehen?` : `${u.name} zum Administrator machen?`}>
                    {u.isAdmin ? "Admin entziehen" : "Zum Admin machen"}
                  </ActionButton>
                )}
                {u.id !== me.id && (
                  <ActionButton action={setDisabledAction.bind(null, u.id, !u.disabled)} confirm={u.disabled ? undefined : `${u.name} sperren?`}>
                    {u.disabled ? "Entsperren" : "Sperren"}
                  </ActionButton>
                )}
              </div>
              {!u.curatorSeat && !u.isAdmin && <PermissionsForm userId={u.id} granted={u.permissions} />}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="einl">
        <h2 id="einl" className="section-title">
          Einladungen
        </h2>
        {invites.length > 0 && (
          <ul className="mt-4">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-3">
                <span>
                  {i.email ?? "beliebige E-Mail"} · {i.grantSeat ? `Kurator ${i.grantSeat}` : ""}
                  {i.grantAdmin ? " · Admin" : ""}
                  <span className="block text-sm text-ink-3">gültig bis {formatDate(i.expiresAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </span>
                <ActionButton action={revokeInviteAction.bind(null, i.id)}>Widerrufen</ActionButton>
              </li>
            ))}
          </ul>
        )}
        <InviteCreate freeSeats={free} />
      </section>
    </div>
  );
}
