"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { pushKeyAction, setPushKindAction, subscribePushAction, testPushAction, unsubscribePushAction } from "@/app/actions/push";

type State = "loading" | "unsupported" | "ios" | "dev" | "denied" | "off" | "on";

function keyBytes(base64: string) {
  const b = atob((base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

/**
 * Push for this browser (one subscription per browser). "raetsel" on the games
 * page speaks of the 10:00 reminder; "alle" in the settings, above the kinds list.
 */
export function PushToggle({ variant = "raetsel" }: { variant?: "raetsel" | "alle" }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = matchMedia("(display-mode: standalone)").matches;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios" : "unsupported");
    // The service worker is only registered in production builds (InstallSw).
    if (process.env.NODE_ENV !== "production") return setState("dev");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setState(s ? "on" : "off"), () => setState("off"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setState(Notification.permission === "denied" ? "denied" : "off");
        return;
      }
      const key = await pushKeyAction();
      if (!key.ok) throw new Error(key.error);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key.data) });
      const r = await subscribePushAction(sub.toJSON());
      if (!r.ok) throw new Error(r.error);
      // Switching on here means: I want the reminder, even if it was off in the settings.
      if (variant === "raetsel") await setPushKindAction("raetsel", true);
      setState("on");
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Hat nicht geklappt.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMsg(null);
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (sub) {
      await unsubscribePushAction(sub.endpoint);
      await sub.unsubscribe().catch(() => {});
    }
    setState("off");
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    const r = await testPushAction();
    setMsg(r.ok ? (r.data.sent ? "Test verschickt." : "Kein Browser angemeldet.") : r.error);
    setBusy(false);
  };

  if (state === "loading") return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border-[1.5px] border-line p-4">
      {state === "on" ? <Bell size={20} aria-hidden /> : <BellOff size={20} className="text-ink-3" aria-hidden />}
      <div className="min-w-0 flex-1">
        <p className="font-bold">{variant === "raetsel" ? "Erinnerung um 10 Uhr" : "Mitteilungen in diesem Browser"}</p>
        <p className="text-sm text-ink-2">
          {state === "on" &&
            (variant === "raetsel" ? (
              <>
                An. Dieser Browser meldet sich, sobald die neuen Rätsel da sind.{" "}
                <Link href="/konto#mitteilungen" className="font-semibold underline">
                  Weitere Mitteilungen
                </Link>
              </>
            ) : (
              "An. Welche Mitteilungen du bekommst, stellst du unten ein."
            ))}
          {state === "off" && (variant === "raetsel" ? "Eine Mitteilung pro Tag, wenn die neuen Rätsel da sind." : "Aus. Schalte sie ein, um Rätsel, Abstimmungen und Antworten mitzubekommen.")}
          {state === "denied" && "Mitteilungen sind für diese Seite blockiert. Erlaube sie in den Browser-Einstellungen."}
          {state === "ios" && "Auf dem iPhone geht das nur, wenn Peake Wörter zum Home-Bildschirm hinzugefügt ist (Teilen → Zum Home-Bildschirm)."}
          {state === "unsupported" && "Dieser Browser kann keine Mitteilungen empfangen."}
          {state === "dev" && "Nur im Produktionsbuild verfügbar (der Service Worker läuft dort)."}
        </p>
        {msg && (
          <p role="status" className="mt-1 text-sm font-semibold">
            {msg}
          </p>
        )}
      </div>
      {state === "off" && (
        <button type="button" className="btn btn-primary btn-sm" onClick={enable} disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Einschalten
        </button>
      )}
      {state === "on" && (
        <span className="flex gap-2">
          <button type="button" className="btn btn-quiet btn-sm" onClick={test} disabled={busy}>
            Test
          </button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={disable} disabled={busy}>
            Ausschalten
          </button>
        </span>
      )}
    </div>
  );
}
