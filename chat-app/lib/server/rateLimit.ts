/** Small in-memory, per-address limiter. Nothing is persisted; it resets when the server restarts. */
export function createLimiter(max: number, windowMs: number) {
    const hits = new Map<string, number[]>();
    return (req: Request): boolean => {
        const ip = (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
        const now = Date.now();
        const recent = (hits.get(ip) || []).filter(t => now - t < windowMs);
        recent.push(now);
        hits.set(ip, recent);
        if (hits.size > 5000) hits.clear();
        return recent.length > max; // true = over the limit
    };
}
