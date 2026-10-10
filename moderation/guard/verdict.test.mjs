import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TERMINATE, buildTranscript, parseCategoryList, parseVerdict, shouldTerminate } from "./verdict.mjs";

test("reads safe and unsafe answers", () => {
  assert.deepEqual(parseVerdict("safe"), { safe: true, categories: [] });
  assert.deepEqual(parseVerdict("  Safe\n"), { safe: true, categories: [] });
  assert.deepEqual(parseVerdict("unsafe\nS1"), { safe: false, categories: ["S1"] });
  assert.deepEqual(parseVerdict("unsafe\nS2,S9"), { safe: false, categories: ["S2", "S9"] });
});

test("never treats a garbled or empty answer as unsafe", () => {
  assert.equal(parseVerdict("").safe, true);
  assert.equal(parseVerdict(undefined).safe, true);
  assert.equal(parseVerdict("I cannot help with that").safe, true);
  // "unsafe" with no recognisable category is not enough to close a room
  assert.equal(parseVerdict("unsafe").safe, true);
  assert.equal(parseVerdict("unsafe\nS99").safe, true);
});

test("parses category lists from env-style strings", () => {
  assert.deepEqual(parseCategoryList("S1, s4 ,S99,S13"), ["S1", "S4", "S13"]);
  assert.deepEqual(parseCategoryList(""), []);
  assert.deepEqual(parseCategoryList(undefined), []);
});

test("only severe categories end a room by default", () => {
  assert.equal(shouldTerminate(["S4"], DEFAULT_TERMINATE), true);
  assert.equal(shouldTerminate(["S1", "S12"], DEFAULT_TERMINATE), true);
  assert.equal(shouldTerminate(["S11"], DEFAULT_TERMINATE), false); // self-harm talk is not punished
  assert.equal(shouldTerminate(["S12", "S10"], DEFAULT_TERMINATE), false);
  assert.equal(shouldTerminate([], DEFAULT_TERMINATE), false);
});

test("transcript puts the checked message last and trims old context first", () => {
  const ctx = [{ sender: "a", text: "first" }, { sender: "b", text: "second" }];
  assert.equal(buildTranscript(ctx, { sender: "c", text: "third" }), "a: first\nb: second\nc: third");
  const long = Array.from({ length: 10 }, (_, i) => ({ sender: "x", text: "y".repeat(500) + i }));
  const out = buildTranscript(long, { sender: "me", text: "the real message" }, 1200);
  assert.ok(out.length <= 1200);
  assert.ok(out.endsWith("me: the real message"));
});
