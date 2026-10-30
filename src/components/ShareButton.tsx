"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { Check, Download, Loader2, Share2 } from "lucide-react";
import { WordCard, type CardData } from "./WordCard";

/**
 * Shares a word: on phones the system share sheet gets the card image plus the
 * public link; without Web Share the link is copied. The image is a snapshot of
 * the real WordCard as rendered here (same fonts and colours as on the site);
 * `fallbackImage` (server-rendered PNG) is used if the snapshot fails.
 */
export function ShareButton({ title, text, url, card, fallbackImage, small }: { title: string; text: string; url: string; card: CardData; fallbackImage: string; small?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "copied">("idle");
  const snap = useRef<HTMLDivElement>(null);
  const ready = useRef<Promise<File> | null>(null);

  // Render the image ahead of time: iOS only allows the share sheet shortly after the tap.
  const cardFile = useCallback(() => {
    ready.current ??= (async () => {
      let blob: Blob | null = null;
      try {
        await document.fonts.ready;
        // First pass loads fonts into the snapshot (needed on Safari), second one is complete.
        await toBlob(snap.current!, { pixelRatio: 3 });
        blob = await toBlob(snap.current!, { pixelRatio: 3 });
      } catch {}
      blob ??= await (await fetch(fallbackImage)).blob();
      return new File([blob], `${title}.png`, { type: "image/png" });
    })();
    return ready.current;
  }, [fallbackImage, title]);

  useEffect(() => {
    const t = setTimeout(() => void cardFile().catch(() => (ready.current = null)), 800);
    return () => clearTimeout(t);
  }, [cardFile]);

  async function share() {
    setState("busy");
    try {
      if (navigator.share) {
        // Some apps drop `url` when files are attached, so the link also goes into the text.
        const file = await cardFile().catch(() => null);
        if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title, text: `${text}\n${url}`, url });
        else await navigator.share({ title, text, url });
        return setState("idle");
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("idle"); // user cancelled
    }
  }

  async function download() {
    const file = await cardFile();
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(file), download: file.name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <>
      <button type="button" onClick={share} disabled={state === "busy"} className={`btn btn-primary ${small ? "btn-sm" : ""}`}>
        {state === "copied" ? <Check size={18} aria-hidden /> : state === "busy" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Share2 size={18} aria-hidden />}
        <span aria-live="polite">{state === "copied" ? "Link kopiert" : "Teilen"}</span>
      </button>
      <button type="button" onClick={download} className={`btn btn-quiet ${small ? "btn-sm" : ""}`}>
        <Download size={17} aria-hidden /> Bild
      </button>
      {/* Off-screen copy of the card, only used as the snapshot source. */}
      <div aria-hidden inert className="pointer-events-none fixed left-[-10000px] top-0">
        <div ref={snap} className="w-[400px] bg-table p-6">
          <WordCard data={card} headingLevel={2} />
        </div>
      </div>
    </>
  );
}
