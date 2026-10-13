"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareButton({ title, text, small }: { title: string; text: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* user cancelled */
    }
  }
  return (
    <button type="button" onClick={share} className={`btn btn-primary ${small ? "btn-sm" : ""}`}>
      {copied ? <Check size={18} aria-hidden /> : <Share2 size={18} aria-hidden />}
      <span aria-live="polite">{copied ? "Link kopiert" : "Teilen"}</span>
    </button>
  );
}
