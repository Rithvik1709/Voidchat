"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitor";

/** Catches errors that no React error boundary sees (event handlers, async code, scripts). */
export default function ClientMonitor() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportError(event.error ?? event.message, "window.onerror");
    const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason, "unhandledrejection");

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
