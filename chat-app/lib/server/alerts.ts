/**
 * Optional alerting. Set ERROR_WEBHOOK_URL to a Slack or Discord incoming-webhook URL to get a
 * message when something breaks. Without it, errors are still written to the server logs.
 * Identical alerts are suppressed for 10 minutes so a loop cannot flood a channel.
 */
const recent = new Map<string, number>();
const SUPPRESS_MS = 10 * 60 * 1000;

export async function sendAlert(text: string, fingerprint = text): Promise<boolean> {
    const url = process.env.ERROR_WEBHOOK_URL;
    if (!url) return false;

    const now = Date.now();
    if (now - (recent.get(fingerprint) ?? 0) < SUPPRESS_MS) return false;
    recent.set(fingerprint, now);
    if (recent.size > 500) recent.clear();

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // `text` is read by Slack, `content` by Discord
            body: JSON.stringify({ text, content: text }),
            signal: AbortSignal.timeout(4000),
        });
        return res.ok;
    } catch {
        return false;
    }
}
