"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitor";

// Last-resort boundary: replaces the root layout, so it brings its own <html> and plain styles.
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => reportError(error, "global-error"), [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0a0a0a", color: "#fafafa", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 36, letterSpacing: "-0.04em", margin: "0 0 12px" }}>Nullchat hit an error.</h1>
            <p style={{ opacity: 0.7, margin: "0 0 24px" }}>It has been reported. Try reloading.</p>
            <button
              onClick={reset}
              style={{ background: "#fafafa", color: "#0a0a0a", border: 0, borderRadius: 999, padding: "14px 32px", fontWeight: 700, cursor: "pointer" }}
              type="button"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
