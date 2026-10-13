"use client";

import { useRef, useState } from "react";
import { Volume2 } from "lucide-react";

/** Only rendered when a real recording exists. */
export function AudioButton({ src, term }: { src: string; term: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.play()}
        className={`grid size-9 place-items-center rounded-full border-[1.5px] border-line transition-colors hover:bg-table-2 ${playing ? "bg-table-2" : ""}`}
        aria-label={`Aussprache von „${term}“ anhören`}
      >
        <Volume2 size={18} aria-hidden />
      </button>
      <audio ref={ref} src={src} preload="none" onPlay={() => setPlaying(true)} onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} />
    </>
  );
}
