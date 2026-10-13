"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, Plus, Undo2, X } from "lucide-react";
import { WordCard, type CardData } from "@/components/WordCard";
import { castVoteAction, retractVoteAction } from "@/app/actions/words";

export type DeckItem = {
  wordId: string;
  term: string;
  card: CardData;
  note: { by: string | null; text: string } | null;
  by: string | null;
};
type Vote = "YES" | "NO" | "LATER";

const LABEL: Record<Vote, string> = { YES: "Ja", NO: "Nein", LATER: "Später" };
const COMMIT_DELAY = 4000; // ms the undo window stays purely client-side
const X_THRESHOLD = 110;
const Y_THRESHOLD = 120;

const STAMP_CLASS: Record<Vote, string> = {
  YES: "left-6 top-[44%] -rotate-12 border-yes text-yes",
  NO: "right-6 top-[44%] rotate-12 border-no text-no",
  LATER: "left-1/2 top-[56%] -translate-x-1/2 -rotate-3 border-later-ink text-later-ink",
};

type Toast = { text: string; undo?: () => void; tone?: "ok" | "error" };

function reducedMotion() {
  return document.documentElement.dataset.motion === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SwipeDeck({ initial }: { initial: DeckItem[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(initial);
  const [toast, setToast] = useState<Toast | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  // The decided card leaves the queue at once; only a ghost copy flies away, so
  // fast taps during the animation are never dropped.
  const [flying, setFlying] = useState<{ key: number; item: DeckItem; vote: Vote; from: { x: number; y: number } } | null>(null);
  const pending = useRef<{ item: DeckItem; vote: Vote; timer: ReturnType<typeof setTimeout> } | null>(null);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const clearFlying = useCallback(() => setFlying(null), []);
  const top = queue[0];

  // ── Server commit ────────────────────────────────────────────
  const commit = useCallback(
    async (item: DeckItem, vote: Vote) => {
      const r = await castVoteAction(item.wordId, vote);
      if (!r.ok) {
        setToast({ text: r.error, tone: "error" });
        return;
      }
      // A newer card is waiting for its undo window: keep that hint on screen.
      if (pending.current) {
        router.refresh();
        return;
      }
      const outcome = r.data.outcome;
      if (outcome === "ACCEPTED") setToast({ text: `„${item.term}“ aufgenommen.`, tone: "ok" });
      else if (outcome === "REJECTED") setToast({ text: `„${item.term}“ → Negativliste.` });
      else if (outcome === "LATER") setToast({ text: `„${item.term}“ → Später.` });
      else
        setToast({
          text: `${LABEL[vote]} · „${item.term}“ gespeichert`,
          undo: async () => {
            const u = await retractVoteAction(item.wordId);
            if (!u.ok) return setToast({ text: u.error, tone: "error" });
            setQueue((q) => [item, ...q]);
            setToast({ text: "Stimme zurückgenommen." });
          },
        });
      router.refresh();
    },
    [router],
  );

  const flush = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    void commit(p.item, p.vote);
  }, [commit]);

  // Never lose a vote when the tab goes away.
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const decide = useCallback(
    (vote: Vote) => {
      if (!top) return;
      flush();
      navigator.vibrate?.(vote === "LATER" ? 8 : 14);
      const item = top;
      setFlying({ key: Date.now(), item, vote, from: { x: drag.x, y: drag.y } });
      setQueue((q) => q.filter((i) => i.wordId !== item.wordId));
      setDrag({ x: 0, y: 0, active: false });
      const undo = () => {
        if (pending.current?.item.wordId !== item.wordId) return;
        clearTimeout(pending.current.timer);
        pending.current = null;
        setQueue((q) => [item, ...q.filter((i) => i.wordId !== item.wordId)]);
        setToast(null);
      };
      pending.current = { item, vote, timer: setTimeout(flush, COMMIT_DELAY) };
      setToast({ text: `${LABEL[vote]} · „${item.term}“`, undo });
    },
    [top, flush, drag.x, drag.y],
  );

  // ── Keyboard ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") decide("YES");
      else if (e.key === "ArrowLeft") decide("NO");
      else if (e.key === "ArrowDown") decide("LATER");
      else if ((e.key === "z" || e.key === "Backspace") && toast?.undo) toast.undo();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide, toast]);

  // ── Pointer gestures ────────────────────────────────────────
  function onDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("a,button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    setDrag({ x: 0, y: 0, active: true });
  }
  function onMove(e: React.PointerEvent) {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: Math.max(-40, e.clientY - start.current.y), active: true });
  }
  function onUp(e: React.PointerEvent) {
    if (!start.current) return;
    const dt = Math.max(1, performance.now() - start.current.t);
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;
    const vx = dx / dt;
    const vy = dy / dt;
    if (dy > Y_THRESHOLD && dy > Math.abs(dx)) return decide("LATER");
    if (dx > X_THRESHOLD || (vx > 0.6 && dx > 60)) return decide("YES");
    if (dx < -X_THRESHOLD || (vx < -0.6 && dx < -60)) return decide("NO");
    if (vy > 0.7 && dy > 90 && dy > Math.abs(dx) * 1.5) return decide("LATER");
    setDrag({ x: 0, y: 0, active: false });
  }

  const { x, y } = drag;
  const intent = {
    YES: Math.min(Math.max(x / X_THRESHOLD, 0), 1),
    NO: Math.min(Math.max(-x / X_THRESHOLD, 0), 1),
    LATER: y > Math.abs(x) ? Math.min(Math.max(y / Y_THRESHOLD, 0), 1) : 0,
  };
  const moving = drag.active;

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem-env(safe-area-inset-bottom)-env(safe-area-inset-top))] max-w-md flex-col px-4 pt-4 md:h-[calc(100dvh-5rem)] md:pt-8">
      <h1 className="sr-only">Abstimmen</h1>
      <p className="mb-3 flex items-baseline justify-between text-sm text-ink-2" aria-live="polite">
        <span>
          <span className="tabular font-bold text-ink">{queue.length}</span> {queue.length === 1 ? "Karte" : "Karten"} im Stapel
        </span>
        {top?.by && <span>von {top.by}</span>}
      </p>

      <div className="relative min-h-0 flex-1" style={{ perspective: "1200px" }}>
        {queue.length === 0 ? (
          <div className="grid h-full place-items-center rounded-[20px] border-2 border-dashed border-line p-8 text-center">
            <div>
              <p className="display text-5xl uppercase">Stapel leer.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link href="/k/neu" className="btn btn-primary">
                  <Plus size={18} aria-hidden /> Wort hinzufügen
                </Link>
                <Link href="/k" className="btn btn-quiet">
                  Zur Übersicht
                </Link>
              </div>
            </div>
          </div>
        ) : (
          queue.slice(0, 3).map((item, i) => {
            const isTop = i === 0;
            const depth = isTop ? 0 : i - (moving ? Math.min(Math.abs(x) / 300, 1) : 0);
            return (
              <div
                key={item.wordId}
                className="absolute inset-0 select-none"
                style={{
                  zIndex: 10 - i,
                  transformOrigin: "50% 100%", // back cards keep their bottom edge visible below the top card
                  touchAction: isTop ? "none" : undefined,
                  transform: isTop
                    ? `translate3d(${x}px, ${y}px, 0) rotate(${x * 0.05}deg)`
                    : `translate3d(0, ${depth * 12}px, 0) scale(${1 - depth * 0.04}) rotate(${i === 1 ? 1.6 : -2.2}deg)`,
                  transition: moving ? "none" : "transform 420ms var(--ease-out-expo)",
                  cursor: isTop ? (moving ? "grabbing" : "grab") : undefined,
                }}
                aria-hidden={!isTop}
                onPointerDown={isTop ? onDown : undefined}
                onPointerMove={isTop ? onMove : undefined}
                onPointerUp={isTop ? onUp : undefined}
                onPointerCancel={isTop ? () => setDrag({ x: 0, y: 0, active: false }) : undefined}
              >
                <WordCard data={item.card} className="h-full" headingLevel={2}>
                  {item.note && (
                    <p className="mt-4 rounded-xl bg-card-2 px-3.5 py-2.5 text-[0.95rem] leading-snug text-card-ink-2">
                      {item.note.by && <span className="font-bold text-card-ink">{item.note.by}: </span>}
                      {item.note.text}
                    </p>
                  )}
                </WordCard>
                {isTop && (
                  <>
                    <Stamp label="Ja" className={STAMP_CLASS.YES} o={intent.YES} />
                    <Stamp label="Nein" className={STAMP_CLASS.NO} o={intent.NO} />
                    <Stamp label="Später" className={STAMP_CLASS.LATER} o={intent.LATER} />
                  </>
                )}
              </div>
            );
          })
        )}
        {flying && <Ghost key={flying.key} item={flying.item} vote={flying.vote} from={flying.from} onDone={clearFlying} />}
      </div>

      <div className="relative flex items-center justify-center gap-5 py-5" role="group" aria-label="Abstimmen">
        <VoteButton vote="NO" onClick={() => decide("NO")} disabled={!top} glow={intent.NO} />
        <VoteButton vote="LATER" onClick={() => decide("LATER")} disabled={!top} glow={intent.LATER} small />
        <VoteButton vote="YES" onClick={() => decide("YES")} disabled={!top} glow={intent.YES} />
      </div>
      <p className="hidden pb-2 text-center text-xs text-ink-3 md:block">
        Tastatur: ← Nein · ↓ Später · → Ja · Z Rückgängig
      </p>

      {toast && (
        <div
          role="status"
          className={`toast-in fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-lg md:bottom-8 ${
            toast.tone === "error" ? "bg-no text-white" : "bg-ink text-table"
          }`}
        >
          <span className="text-[0.95rem] font-semibold">{toast.text}</span>
          <span className="flex shrink-0 items-center gap-1">
            {toast.undo && (
              <button type="button" onClick={toast.undo} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 font-bold underline-offset-2 hover:underline">
                <Undo2 size={17} aria-hidden /> Rückgängig
              </button>
            )}
            <button type="button" onClick={() => setToast(null)} className="grid size-10 place-items-center rounded-full opacity-70 hover:opacity-100" aria-label="Hinweis schließen">
              <X size={17} aria-hidden />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

/** Copy of the decided card that flies off screen (or fades with reduced motion). */
function Ghost({ item, vote, from, onDone }: { item: DeckItem; vote: Vote; from: { x: number; y: number }; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = `translate3d(${from.x}px, ${from.y}px, 0) rotate(${from.x * 0.05}deg)`;
    const to =
      vote === "YES"
        ? { x: window.innerWidth, y: from.y + 60 }
        : vote === "NO"
          ? { x: -window.innerWidth, y: from.y + 60 }
          : { x: from.x, y: window.innerHeight };
    const frames: Keyframe[] = reducedMotion()
      ? [{ transform: start, opacity: 1 }, { transform: start, opacity: 0 }]
      : [{ transform: start }, { transform: `translate3d(${to.x}px, ${to.y}px, 0) rotate(${to.x * 0.04}deg)` }];
    const a = el.animate(frames, { duration: reducedMotion() ? 150 : 340, easing: "cubic-bezier(0.4, 0, 0.6, 1)", fill: "forwards" });
    a.onfinish = onDone;
    return () => a.cancel();
  }, [from, vote, onDone]);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-20">
      <WordCard data={item.card} className="h-full" headingLevel={2} />
      <Stamp label={LABEL[vote]} className={STAMP_CLASS[vote]} o={1} />
    </div>
  );
}

function Stamp({ label, className, o }: { label: string; className: string; o: number }) {
  return (
    <span
      aria-hidden
      className={`stamp pointer-events-none absolute rounded-lg border-[4px] px-3.5 py-1 display text-[3.4rem] uppercase ${className}`}
      style={{ opacity: o, transform: undefined, scale: `${1.25 - o * 0.25}` }}
    >
      {label}
    </span>
  );
}

function VoteButton({ vote, onClick, disabled, glow, small }: { vote: Vote; onClick: () => void; disabled: boolean; glow: number; small?: boolean }) {
  const Icon = vote === "YES" ? Check : vote === "NO" ? X : Clock;
  const color = vote === "YES" ? "var(--yes)" : vote === "NO" ? "var(--no)" : "var(--later)";
  const size = small ? 52 : 68;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={LABEL[vote]}
      aria-keyshortcuts={vote === "YES" ? "ArrowRight" : vote === "NO" ? "ArrowLeft" : "ArrowDown"}
      className="grid place-items-center rounded-full border-[3px] bg-table-2 transition-[transform,background-color] duration-200 ease-[var(--ease-out-expo)] active:scale-90 disabled:opacity-35"
      style={{
        width: size,
        height: size,
        borderColor: color,
        color: glow > 0.2 ? (vote === "LATER" ? "var(--later-ink)" : "#fff") : vote === "LATER" ? "var(--ink)" : color,
        background: glow > 0.2 ? color : undefined,
        transform: `scale(${1 + glow * 0.12})`,
      }}
    >
      <Icon size={small ? 22 : 32} strokeWidth={3} aria-hidden />
    </button>
  );
}
