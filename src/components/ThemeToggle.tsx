"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Mode = "system" | "light" | "dark";
const next: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const label: Record<Mode, string> = { system: "Systemfarben", light: "Hell", dark: "Dunkel" };

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    try {
      setMode((localStorage.getItem("theme") as Mode) || "system");
    } catch {}
  }, []);

  function cycle() {
    const m = next[mode];
    setMode(m);
    const d = document.documentElement;
    try {
      if (m === "system") {
        delete d.dataset.theme;
        localStorage.removeItem("theme");
      } else {
        d.dataset.theme = m;
        localStorage.setItem("theme", m);
      }
    } catch {}
  }

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={cycle}
      className="grid size-10 place-items-center rounded-full text-ink-2 hover:text-ink hover:bg-table-2 transition-colors"
      aria-label={`Farbschema: ${label[mode]}. Wechseln zu ${label[next[mode]]}`}
      title={`Farbschema: ${label[mode]}`}
    >
      <Icon size={19} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
