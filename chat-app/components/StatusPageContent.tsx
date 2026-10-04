"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageShell, Eyebrow } from "@/components/SiteChrome";
import { cn } from "@/lib/utils";

type Result = { ok: boolean; ms: number };
type Sample = { at: number; ok: boolean };
type Key = "website" | "database" | "storage" | "realtime";

const COMPONENTS: { key: Key; name: string; desc: string }[] = [
  { key: "website", name: "Website & API", desc: "Pages and server routes" },
  { key: "database", name: "Room database", desc: "Creating and listing rooms" },
  { key: "storage", name: "Image storage", desc: "Uploads and media cleanup" },
  { key: "realtime", name: "Realtime messaging", desc: "Live chat and presence" },
];

const REFRESH_MS = 30_000;
const HISTORY = 30;

/** Opens a throwaway realtime channel and waits for it to connect. */
function checkRealtime(): Promise<Result> {
  const started = Date.now();
  return new Promise(resolve => {
    const channel = supabase.channel(`status-ping-${crypto.randomUUID()}`);
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      supabase.removeChannel(channel);
      resolve({ ok, ms: Date.now() - started });
    };
    const timer = setTimeout(() => finish(false), 7000);
    channel.subscribe(status => {
      if (status === "SUBSCRIBED") finish(true);
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") finish(false);
    });
  });
}

export default function StatusPageContent() {
  const [results, setResults] = useState<Partial<Record<Key, Result>>>({});
  const [history, setHistory] = useState<Record<Key, Sample[]>>({ website: [], database: [], storage: [], realtime: [] });
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [now, setNow] = useState(0);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setChecking(true);

    const started = Date.now();
    const [health, realtime] = await Promise.all([
      fetch("/api/health", { cache: "no-store" })
        .then(async res => {
          const data = await res.json().catch(() => null);
          return { reachable: true, data: data as { checks?: { database?: Result; storage?: Result } } | null };
        })
        .catch(() => ({ reachable: false, data: null })),
      checkRealtime(),
    ]);

    const next: Record<Key, Result> = {
      website: { ok: health.reachable && health.data !== null, ms: Date.now() - started },
      database: health.data?.checks?.database ?? { ok: false, ms: 0 },
      storage: health.data?.checks?.storage ?? { ok: false, ms: 0 },
      realtime,
    };

    const now = Date.now();
    setResults(next);
    setHistory(prev => {
      const out = { ...prev };
      (Object.keys(next) as Key[]).forEach(k => {
        out[k] = [...prev[k], { at: now, ok: next[k].ok }].slice(-HISTORY);
      });
      return out;
    });
    setCheckedAt(now);
    setChecking(false);
    running.current = false;
  }, []);

  useEffect(() => {
    const first = setTimeout(run, 0);
    const id = setInterval(run, REFRESH_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      clearInterval(tick);
    };
  }, [run]);

  const have = Object.keys(results).length > 0;
  const failing = COMPONENTS.filter(c => results[c.key] && !results[c.key]!.ok).length;
  const overall = !have ? "checking" : failing === 0 ? "ok" : failing === COMPONENTS.length ? "down" : "degraded";
  const headline = {
    checking: "Checking systems…",
    ok: "All systems operational",
    degraded: "Some systems are having problems",
    down: "Major outage",
  }[overall];
  const ago = checkedAt && now ? Math.max(0, Math.round((now - checkedAt) / 1000)) : checkedAt ? 0 : null;

  return (
    <PageShell>
      <section className="mx-auto max-w-3xl px-4 pb-28 pt-32 sm:px-6 md:pt-44">
        <Eyebrow>System status</Eyebrow>
        <h1 className="text-5xl font-bold leading-[0.92] tracking-tighter md:text-6xl">Status</h1>

        <div
          aria-live="polite"
          className={cn(
            "mt-10 flex items-center justify-between gap-4 rounded-3xl border p-6",
            overall === "ok" ? "border-foreground/40 bg-card/60" : overall === "checking" ? "border-border bg-card/60" : "border-destructive/50 bg-destructive/10"
          )}
        >
          <div className="flex items-center gap-4">
            <span
              className={cn(
                "grid h-11 w-11 shrink-0 place-items-center rounded-full",
                overall === "ok" ? "bg-foreground text-background" : overall === "checking" ? "bg-muted text-muted-foreground" : "bg-destructive text-destructive-foreground"
              )}
            >
              {overall === "checking" ? <Loader2 className="h-5 w-5 animate-spin" /> : overall === "ok" ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
            </span>
            <div>
              <div className="text-xl font-bold tracking-tight">{headline}</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                {ago === null ? "Running first check" : `Checked ${ago}s ago · refreshes every 30s`}
              </div>
            </div>
          </div>
          <button
            aria-label="Check again"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border transition-colors hover:border-foreground/40 disabled:opacity-50"
            disabled={checking}
            onClick={run}
            type="button"
          >
            <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
          </button>
        </div>

        <div className="mt-6 divide-y divide-border overflow-hidden rounded-3xl border border-border">
          {COMPONENTS.map(c => {
            const r = results[c.key];
            const samples = history[c.key];
            const uptime = samples.length ? Math.round((samples.filter(s => s.ok).length / samples.length) * 100) : null;
            return (
              <div className="p-5 sm:p-6" key={c.key}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold tracking-tight">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{c.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("flex items-center justify-end gap-2 text-sm font-semibold", r && !r.ok && "text-destructive")}>
                      <span className={cn("h-2 w-2 rounded-full", !r ? "bg-muted-foreground" : r.ok ? "bg-foreground" : "bg-destructive")} />
                      {!r ? "Checking" : r.ok ? "Operational" : "Unavailable"}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">{r && r.ok ? `${r.ms} ms` : "—"}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-end gap-[3px]" aria-hidden>
                  {Array.from({ length: HISTORY }).map((_, i) => {
                    const sample = samples[samples.length - HISTORY + i];
                    return (
                      <span
                        className={cn("h-6 flex-1 rounded-sm", !sample ? "bg-muted" : sample.ok ? "bg-foreground" : "bg-destructive")}
                        key={i}
                      />
                    );
                  })}
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {uptime === null ? "No data yet" : `${uptime}% this visit · last ${samples.length} checks`}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          These checks run live from your browser. Nullchat does not keep a history of past
          outages: the bars show only this visit.
        </p>
      </section>
    </PageShell>
  );
}
