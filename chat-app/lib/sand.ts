/**
 * The physics behind the "sand" burn effect. Pure functions so the look can be tuned (and tested)
 * without a browser: a front sweeps across a message, shedding grains that the wind carries off.
 */

export type Grain = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    /** seconds lived */
    age: number;
    /** seconds until gone */
    life: number;
    size: number;
    /** index into the colour palette */
    tone: number;
};

export type Box = { x: number; y: number; w: number; h: number };

/** Time the front takes to cross the message, and how long the last grains linger. */
export const SWEEP_MS = 1400;
export const MAX_GRAINS = 1400;
/** Soft edge of the front, as a share of the message width. */
export const EDGE = 0.14;

/** 0..1 progress of the sweep (eased so it starts gently and ends decisively). */
export function sweepProgress(elapsedMs: number): number {
    const t = Math.min(1, Math.max(0, elapsedMs / SWEEP_MS));
    return t * t * (3 - 2 * t); // smoothstep
}

/** x position of the front for a message box, sweeping away from the side the wind blows from. */
export function frontX(box: Box, progress: number, windDir: 1 | -1): number {
    return windDir === 1 ? box.x + box.w * progress : box.x + box.w * (1 - progress);
}

/** Grains shed this frame along the front. `rand` is injectable for tests. */
export function spawnGrains(
    box: Box, front: number, count: number, windDir: 1 | -1, tones: number, rand: () => number = Math.random
): Grain[] {
    const out: Grain[] = [];
    for (let i = 0; i < count; i++) {
        const spread = (rand() - 0.5) * box.w * EDGE * 1.4;
        out.push({
            x: Math.min(box.x + box.w, Math.max(box.x, front + spread)),
            y: box.y + rand() * box.h,
            vx: windDir * (30 + rand() * 120),
            vy: -25 + rand() * 60,
            age: 0,
            life: 0.7 + rand() * 0.6,
            size: 1 + rand() * 1.6,
            tone: Math.floor(rand() * tones),
        });
    }
    return out;
}

/** Advance grains by `dt` seconds. Wind keeps pushing, gravity pulls; spent grains are dropped. */
export function stepGrains(grains: Grain[], dt: number, windDir: 1 | -1): Grain[] {
    const alive: Grain[] = [];
    for (const g of grains) {
        const age = g.age + dt;
        if (age >= g.life) continue;
        alive.push({
            ...g,
            age,
            vx: g.vx + windDir * 140 * dt,
            vy: g.vy + 55 * dt,
            x: g.x + g.vx * dt,
            y: g.y + g.vy * dt,
        });
    }
    return alive;
}

/** Fade grains out as they near the end of their life. */
export const grainAlpha = (g: Grain) => Math.max(0, 1 - (g.age / g.life) ** 2);
