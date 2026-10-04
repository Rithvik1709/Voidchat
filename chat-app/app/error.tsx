"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { reportError } from "@/lib/monitor";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => reportError(error, "error-boundary"), [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <div className="max-w-md text-center">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Something broke</div>
        <h1 className="text-4xl font-bold leading-[0.95] tracking-tighter">That page hit an error.</h1>
        <p className="mt-4 text-muted-foreground">It has been reported. You can try again or head back home.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 font-bold text-background transition-transform hover:scale-[1.03] active:scale-95"
            onClick={reset}
            type="button"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Try again
          </button>
          <Link
            className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 font-semibold transition-colors hover:border-foreground/40"
            href="/"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
