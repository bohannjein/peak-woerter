"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { renderSVG } from "uqr";
import { Copy, Fingerprint, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { authClient, authError } from "@/lib/auth-client";

type Passkey = { id: string; name?: string | null; createdAt?: string | Date | null; deviceType?: string };

function Msg({ text, tone = "error" }: { text: string | null; tone?: "error" | "ok" }) {
  if (!text) return null;
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`mt-4 rounded-xl border-[1.5px] px-4 py-3 text-[0.95rem] font-medium ${tone === "error" ? "border-no/60 bg-no/10" : "border-yes/60 bg-yes/10"}`}>
      {text}
    </p>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-2xl border-[1.5px] border-later bg-later/10 p-4">
      <p className="font-bold">Wiederherstellungscodes</p>
      <p className="mt-1 text-sm text-ink-2">Nur jetzt sichtbar. Jeder Code gilt einmal.</p>
      <ul className="tabular mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[0.95rem]">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-quiet btn-sm mt-3"
        onClick={async () => {
          await navigator.clipboard.writeText(codes.join("\n"));
          setCopied(true);
        }}
      >
        <Copy size={16} aria-hidden /> {copied ? "Kopiert" : "Alle kopieren"}
      </button>
    </div>
  );
}

export function SecurityPanel({ has2fa, required = [] }: { has2fa: boolean; required?: ("2fa" | "passkey")[] }) {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [totp, setTotp] = useState<{ uri: string; codes: string[] } | null>(null);
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);

  async function loadPasskeys() {
    const { data } = await authClient.passkey.listUserPasskeys();
    setPasskeys((data as Passkey[]) ?? []);
  }
  useEffect(() => {
    loadPasskeys();
  }, []);

  async function act(key: string, fn: () => Promise<string | void>) {
    setBusy(key);
    setErr(null);
    setOk(null);
    try {
      const m = await fn();
      if (m) setOk(m);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    } finally {
      setBusy(null);
    }
  }
  const fail = (e: Parameters<typeof authError>[0]) => {
    throw new Error(authError(e));
  };

  const secret = totp ? new URL(totp.uri).searchParams.get("secret") : null;

  return (
    <div className="space-y-12">
      {/* Passkeys */}
      <section aria-labelledby="pk">
        <div className="flex items-center gap-3">
          <Fingerprint size={26} aria-hidden />
          <h2 id="pk" className="section-title">Passkeys</h2>
          {required.includes("passkey") && <span className="rounded-full bg-no px-2.5 py-0.5 text-xs font-bold text-white">Pflicht</span>}
        </div>
        <ul className="mt-4 divide-y divide-line rounded-2xl border-[1.5px] border-line">
          {passkeys === null ? (
            <li className="p-4 text-ink-3">Lade …</li>
          ) : passkeys.length === 0 ? (
            <li className="p-4 text-ink-2">Keine.</li>
          ) : (
            passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                <span>
                  <span className="font-semibold">{p.name || "Passkey"}</span>
                  {p.createdAt && <span className="block text-sm text-ink-3">seit {new Date(p.createdAt).toLocaleDateString("de-DE")}</span>}
                </span>
                <button
                  type="button"
                  className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-table-2 hover:text-no"
                  aria-label={`Passkey ${p.name || ""} entfernen`}
                  disabled={!!busy}
                  onClick={() =>
                    act("del" + p.id, async () => {
                      if (!confirm("Passkey entfernen?")) return;
                      const { error } = await authClient.passkey.deletePasskey({ id: p.id });
                      if (error) fail(error);
                      await loadPasskeys();
                      router.refresh();
                      return "Passkey entfernt.";
                    })
                  }
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </li>
            ))
          )}
        </ul>
        <button
          type="button"
          className="btn btn-primary mt-4"
          disabled={!!busy}
          onClick={() =>
            act("addpk", async () => {
              const name = prompt("Name (z. B. iPhone)", "") ?? undefined;
              const res = await authClient.passkey.addPasskey({ name: name || undefined });
              if (res?.error) fail(res.error);
              await loadPasskeys();
              router.refresh();
              return "Passkey hinzugefügt.";
            })
          }
        >
          {busy === "addpk" ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <KeyRound size={18} aria-hidden />} Passkey hinzufügen
        </button>
      </section>

      {/* TOTP */}
      <section aria-labelledby="tf">
        <div className="flex items-center gap-3">
          <ShieldCheck size={26} aria-hidden />
          <h2 id="tf" className="section-title">Zwei-Faktor-Code</h2>
          {required.includes("2fa") && <span className="rounded-full bg-no px-2.5 py-0.5 text-xs font-bold text-white">Pflicht</span>}
        </div>
        <p className="mt-2 max-w-prose text-ink-2">
          TOTP:{" "}
          <strong className={has2fa ? "text-yes" : ""}>{has2fa ? "aktiv" : "nicht eingerichtet"}</strong>
        </p>

        {!has2fa && !totp && (
          <form
            className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row"
            action={(fd) =>
              act("tfon", async () => {
                const { data, error } = await authClient.twoFactor.enable({ password: String(fd.get("pw")) });
                if (error) fail(error);
                if (data && "totpURI" in data) setTotp({ uri: data.totpURI, codes: data.backupCodes });
              })
            }
          >
            <label htmlFor="tf-pw" className="sr-only">
              Passwort zur Bestätigung
            </label>
            <input id="tf-pw" name="pw" type="password" required placeholder="Passwort zur Bestätigung" autoComplete="current-password" className="field" />
            <button className="btn btn-primary shrink-0" disabled={!!busy}>
              Einrichten
            </button>
          </form>
        )}

        {totp && (
          <div className="mt-5 grid gap-6 rounded-2xl border-[1.5px] border-line p-5 md:grid-cols-[12rem_1fr]">
            <div className="rounded-xl bg-white p-3" aria-hidden dangerouslySetInnerHTML={{ __html: renderSVG(totp.uri, { border: 1 }) }} />
            <div>
              <p className="font-bold">1. Code scannen</p>
              <p className="mt-1 text-sm text-ink-2">
                Mit der Authenticator-App scannen oder{" "}
                <a href={totp.uri} className="font-semibold text-ink underline">
                  öffnen
                </a>
                . Schlüssel:
              </p>
              <p className="tabular mt-2 break-all font-mono text-sm">{secret}</p>
              <form
                className="mt-5"
                action={(fd) =>
                  act("tfverify", async () => {
                    const { error } = await authClient.twoFactor.verifyTotp({ code: String(fd.get("code")).replace(/\s/g, "") });
                    if (error) fail(error);
                    setFreshCodes(totp.codes);
                    setTotp(null);
                    router.refresh();
                    return "Zwei-Faktor-Code ist aktiv.";
                  })
                }
              >
                <label htmlFor="tf-code" className="label">
                  2. Code aus der App eingeben
                </label>
                <div className="flex gap-2">
                  <input id="tf-code" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" className="field tabular max-w-40 text-center text-xl tracking-[0.25em]" />
                  <button className="btn btn-primary" disabled={!!busy}>
                    Aktivieren
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {freshCodes && <BackupCodes codes={freshCodes} />}

        {has2fa && (
          <div className="mt-4 flex flex-wrap gap-3">
            <form
              className="flex gap-2"
              action={(fd) =>
                act("codes", async () => {
                  const { data, error } = await authClient.twoFactor.generateBackupCodes({ password: String(fd.get("pw")) });
                  if (error) fail(error);
                  if (data) setFreshCodes(data.backupCodes);
                  return "Neue Codes erstellt. Alte ungültig.";
                })
              }
            >
              <label htmlFor="codes-pw" className="sr-only">
                Passwort
              </label>
              <input id="codes-pw" name="pw" type="password" required placeholder="Passwort" autoComplete="current-password" className="field max-w-48" />
              <button className="btn btn-quiet shrink-0" disabled={!!busy}>
                Neue Codes
              </button>
            </form>
            <form
              className="flex gap-2"
              action={(fd) =>
                act("tfoff", async () => {
                  if (required.includes("2fa") || !confirm("Zwei-Faktor-Code abschalten?")) return;
                  const { error } = await authClient.twoFactor.disable({ password: String(fd.get("pw")) });
                  if (error) fail(error);
                  router.refresh();
                  return "Zwei-Faktor-Code abgeschaltet.";
                })
              }
            >
              <label htmlFor="off-pw" className="sr-only">
                Passwort
              </label>
              <input id="off-pw" name="pw" type="password" required placeholder="Passwort" autoComplete="current-password" className="field max-w-48" />
              <button className="btn btn-quiet shrink-0" disabled={!!busy}>
                Abschalten
              </button>
            </form>
          </div>
        )}
      </section>

      <Msg text={err} />
      <Msg text={ok} tone="ok" />
    </div>
  );
}

export function PasswordForm() {
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  return (
    <form
      className="max-w-md space-y-4"
      action={async (fd) => {
        const next = String(fd.get("new"));
        if (next !== String(fd.get("new2"))) return setMsg({ t: "Die neuen Passwörter stimmen nicht überein.", ok: false });
        const { error } = await authClient.changePassword({ currentPassword: String(fd.get("cur")), newPassword: next, revokeOtherSessions: true });
        setMsg(error ? { t: error.code === "PASSWORD_TOO_SHORT" ? "Mindestens 12 Zeichen." : authError(error), ok: false } : { t: "Passwort geändert. Andere Geräte abgemeldet.", ok: true });
      }}
    >
      <div>
        <label htmlFor="cur" className="label">
          Aktuelles Passwort
        </label>
        <input id="cur" name="cur" type="password" required autoComplete="current-password" className="field" />
      </div>
      <div>
        <label htmlFor="new" className="label">
          Neues Passwort
        </label>
        <input id="new" name="new" type="password" required minLength={12} autoComplete="new-password" className="field" />
        <p className="hint">Mindestens 12 Zeichen.</p>
      </div>
      <div>
        <label htmlFor="new2" className="label">
          Neues Passwort wiederholen
        </label>
        <input id="new2" name="new2" type="password" required minLength={12} autoComplete="new-password" className="field" />
      </div>
      <button className="btn btn-primary">Passwort ändern</button>
      {msg && <Msg text={msg.t} tone={msg.ok ? "ok" : "error"} />}
    </form>
  );
}
