"use client";

import { useEffect } from "react";
import { markNotificationsReadAction } from "@/app/actions/member";

/** Marks everything read once the page was actually seen (not on prefetch). */
export function MarkRead() {
  useEffect(() => {
    void markNotificationsReadAction();
  }, []);
  return null;
}
