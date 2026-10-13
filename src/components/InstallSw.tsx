"use client";

import { useEffect } from "react";

/** Registers the minimal service worker (app shell + offline page). */
export function InstallSw() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
