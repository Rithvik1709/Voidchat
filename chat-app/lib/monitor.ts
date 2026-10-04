/**
 * Privacy-preserving client error reporting.
 *
 * Sends only: an error message, a short stack, a label for where it happened, and the page
 * pattern (never the real URL). Room keys (#key=...), room ids and anything that looks like a
 * key or token are scrubbed first. No user ids, no cookies, no message content.
 */

const MAX_MESSAGE = 300;
const MAX_STACK = 1500;
const MAX_PER_SESSION = 8;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Remove anything that could identify a room or contain key material. */
export function scrub(text: string): string {
    return text
        .replace(/#key=[^\s"')]+/gi, '#key=[removed]')
        .replace(/[?&]key=[^\s"'&)]+/gi, 'key=[removed]')
        .replace(/"(k|d|x|y)"\s*:\s*"[^"]+"/g, '"$1":"[removed]"')
        .replace(UUID_RE, '[id]')
        .replace(/[A-Za-z0-9+/_-]{40,}={0,2}/g, '[redacted]');
}

/** /chat/<id> -> /chat/[id]; never reports query strings or hashes. */
export function routePattern(pathname: string): string {
    return scrub(pathname.split('?')[0].split('#')[0]);
}

export type ErrorReport = { message: string; stack: string; context: string; path: string };

export function buildReport(error: unknown, context: string, pathname: string): ErrorReport {
    const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error');
    return {
        message: scrub(String(err.message || 'Unknown error')).slice(0, MAX_MESSAGE),
        stack: scrub(String(err.stack || '')).slice(0, MAX_STACK),
        context: scrub(context).slice(0, 60),
        path: routePattern(pathname),
    };
}

let sent = 0;
const seen = new Set<string>();

export function reportError(error: unknown, context = 'client') {
    try {
        if (typeof window === 'undefined' || sent >= MAX_PER_SESSION) return;
        const report = buildReport(error, context, window.location.pathname);
        const fingerprint = `${report.context}|${report.message}`;
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);
        sent++;

        const body = JSON.stringify(report);
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/monitor/error', new Blob([body], { type: 'application/json' }));
        } else {
            fetch('/api/monitor/error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
        }
    } catch {
        /* monitoring must never throw */
    }
}
