/**
 * Nullchat guard: a tiny authenticated front door to Llama Guard 3 1B running in Ollama.
 *
 * - Requires a shared secret (GUARD_SECRET), so only the Nullchat app can use it.
 * - Never logs or stores message text. Verdicts are cached in memory by a hash only,
 *   so several people in the same room checking the same message cost one model call.
 */
import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { DEFAULT_TERMINATE, buildTranscript, parseCategoryList, parseVerdict, shouldTerminate } from "./verdict.mjs";

const PORT = Number(process.env.PORT || 8080);
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
const MODEL = process.env.GUARD_MODEL || "llama-guard3:1b";
const SECRET = process.env.GUARD_SECRET || "";
const TERMINATE = parseCategoryList(process.env.TERMINATE_CATEGORIES).length
  ? parseCategoryList(process.env.TERMINATE_CATEGORIES)
  : DEFAULT_TERMINATE;
const MAX_PARALLEL = Number(process.env.MAX_PARALLEL || 2);
const CACHE_TTL_MS = 15 * 60_000;

if (!SECRET) {
  console.error("GUARD_SECRET is not set; refusing to start without authentication.");
  process.exit(1);
}

const sha = (s) => createHash("sha256").update(s).digest("hex");

/* ---------------- verdict cache (hash keys only, no text) ---------------- */

const cache = new Map(); // key -> { at, verdict }
const inflight = new Map(); // key -> Promise<verdict>

function cached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.verdict;
}

function remember(key, verdict) {
  cache.set(key, { at: Date.now(), verdict });
  if (cache.size > 20_000) {
    // drop the oldest quarter
    let n = 0;
    for (const k of cache.keys()) {
      cache.delete(k);
      if (++n > 5_000) break;
    }
  }
}

/* ---------------- model calls, a few at a time ---------------- */

let running = 0;
const waiting = [];
async function withSlot(fn) {
  if (running >= MAX_PARALLEL) await new Promise((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

async function classify(transcript) {
  return withSlot(async () => {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        keep_alive: -1,
        options: { temperature: 0, num_predict: 12 },
        messages: [{ role: "user", content: transcript }],
      }),
    });
    if (!res.ok) throw new Error(`model returned ${res.status}`);
    const data = await res.json();
    return parseVerdict(data?.message?.content);
  });
}

async function judge(room, context, message) {
  const key = sha(`${room}|${message.id}|${message.text}`);
  const hit = cached(key);
  if (hit) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const p = classify(buildTranscript(context, message))
    .then((v) => {
      remember(key, v);
      return v;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/* ---------------- HTTP ---------------- */

function authorized(req) {
  const got = Buffer.from((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(SECRET);
  return got.length === want.length && timingSafeEqual(got, want);
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("bad json"));
      }
    });
    req.on("error", reject);
  });
}

const cleanMsg = (m) =>
  m && typeof m.text === "string" && m.text.trim()
    ? { id: String(m.id ?? "").slice(0, 64), sender: String(m.sender ?? "?").slice(0, 32), text: m.text.slice(0, 2000) }
    : null;

createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      const up = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok).catch(() => false);
      return send(res, up ? 200 : 503, { ok: up, model: MODEL, terminate: TERMINATE });
    }
    if (req.method !== "POST" || req.url !== "/check") return send(res, 404, { error: "not found" });
    if (!authorized(req)) return send(res, 401, { error: "unauthorized" });

    const body = await readJson(req);
    const room = typeof body.room === "string" ? body.room.slice(0, 128) : "";
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(0, 20).map(cleanMsg).filter(Boolean);
    const context = (Array.isArray(body.context) ? body.context : []).slice(-6).map(cleanMsg).filter(Boolean);
    if (!room || messages.length === 0) return send(res, 400, { error: "nothing to check" });

    // Each message is judged with the lines just before it as context
    const flagged = new Set();
    const history = [...context];
    for (const m of messages) {
      const v = await judge(room, history.slice(-4), m);
      v.categories.forEach((c) => flagged.add(c));
      history.push(m);
    }
    const categories = [...flagged];
    return send(res, 200, { safe: categories.length === 0, categories, terminate: shouldTerminate(categories, TERMINATE) });
  } catch (err) {
    // Message text is never included in logs
    console.error("check failed:", err instanceof Error ? err.message : "unknown error");
    return send(res, 502, { error: "guard unavailable" });
  }
}).listen(PORT, "::", () => console.log(`guard listening on ${PORT}, model ${MODEL}, terminate ${TERMINATE.join(",")}`));
