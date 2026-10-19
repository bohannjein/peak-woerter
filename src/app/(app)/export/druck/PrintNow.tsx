"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintNow() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <button type="button" onClick={() => window.print()} className="btn btn-primary btn-sm mb-6 print:hidden">
      <Printer size={17} aria-hidden /> Drucken / als PDF speichern
    </button>
  );
}
