"use client";

import { useState } from "react";
import { Check, Download, Loader2, Share2 } from "lucide-react";

/**
 * Shares a word: on phones the system share sheet gets the card image plus the
 * public link; without Web Share the link is copied. `url` is the public share
 * link (/teilen/…?k=…), `image` the card PNG.
 */
export function ShareButton({ title, text, url, image, small }: { title: string; text: string; url: string; image: string; small?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "copied">("idle");

  async function cardFile() {
    const blob = await (await fetch(image)).blob();
    return new File([blob], `${title}.png`, { type: "image/png" });
  }

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

  return (
    <>
      <button type="button" onClick={share} disabled={state === "busy"} className={`btn btn-primary ${small ? "btn-sm" : ""}`}>
        {state === "copied" ? <Check size={18} aria-hidden /> : state === "busy" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Share2 size={18} aria-hidden />}
        <span aria-live="polite">{state === "copied" ? "Link kopiert" : "Teilen"}</span>
      </button>
      <a href={image} download={`${title}.png`} className={`btn btn-quiet ${small ? "btn-sm" : ""}`}>
        <Download size={17} aria-hidden /> Bild
      </a>
    </>
  );
}
