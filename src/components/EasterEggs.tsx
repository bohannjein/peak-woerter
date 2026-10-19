"use client";

import { useEffect, useState } from "react";

const CODE = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

/** Konami code: every card on the page does a little lap of honour. */
export function EasterEggs() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let i = 0;
    const onKey = (e: KeyboardEvent) => {
      i = e.key === CODE[i] ? i + 1 : e.key === CODE[0] ? 1 : 0;
      if (i < CODE.length) return;
      i = 0;
      document.documentElement.classList.add("peak-mode");
      setShown(true);
      setTimeout(() => {
        document.documentElement.classList.remove("peak-mode");
        setShown(false);
      }, 3500);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!shown) return null;
  return (
    <p role="status" className="toast-in fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-ink px-5 py-3 font-bold text-table md:bottom-8">
      Peak erreicht. Höher geht’s nicht.
    </p>
  );
}
