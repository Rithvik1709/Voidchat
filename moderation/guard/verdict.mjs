/** Pure helpers for reading Llama Guard's answer. Kept separate so they can be tested without a model. */

/** Llama Guard 3 hazard categories (the 1B model uses S1-S13). */
export const CATEGORIES = {
  S1: "Violent Crimes",
  S2: "Non-Violent Crimes",
  S3: "Sex-Related Crimes",
  S4: "Child Sexual Exploitation",
  S5: "Defamation",
  S6: "Specialized Advice",
  S7: "Privacy",
  S8: "Intellectual Property",
  S9: "Indiscriminate Weapons",
  S10: "Hate",
  S11: "Suicide & Self-Harm",
  S12: "Sexual Content",
  S13: "Elections",
};

/** Categories that end a room unless overridden by TERMINATE_CATEGORIES. */
export const DEFAULT_TERMINATE = ["S1", "S2", "S3", "S4", "S9"];

/** "S1, s4 ,S99" -> ["S1", "S4"] (unknown codes are dropped). */
export function parseCategoryList(value) {
  if (!value) return [];
  return String(value)
    .split(/[\s,]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c in CATEGORIES);
}

/**
 * Llama Guard replies "safe", or "unsafe" followed by a line of category codes.
 * Anything unexpected is treated as safe: a garbled answer must never close a room.
 */
export function parseVerdict(raw) {
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text.startsWith("unsafe")) return { safe: true, categories: [] };
  const categories = parseCategoryList(text.slice("unsafe".length).replace(/\n/g, ","));
  return { safe: categories.length === 0, categories };
}

/** True when any flagged category is one that ends the room. */
export function shouldTerminate(categories, terminateList) {
  return categories.some((c) => terminateList.includes(c));
}

/**
 * The conversation Llama Guard judges: a few earlier lines for context, then the
 * message being checked last. Names are kept so "who said what" is clear.
 */
export function buildTranscript(context, message, maxChars = 2400) {
  const line = (m) => `${String(m.sender).slice(0, 32)}: ${String(m.text).replace(/\s+/g, " ").slice(0, 800)}`;
  const lines = [...context.map(line), line(message)];
  let out = lines.join("\n");
  // Trim the oldest context first if the whole thing is too long
  while (out.length > maxChars && lines.length > 1) {
    lines.shift();
    out = lines.join("\n");
  }
  return out.slice(-maxChars);
}
