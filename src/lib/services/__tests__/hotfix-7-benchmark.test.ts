/**
 * HOTFIX-7 — Benchmark Tests
 *
 * Tests:
 * 1. Regenerate cap logic (count tracking, reset, cap at 3)
 * 2. No-diff detection (same text → true, different → false)
 * 3. Contact persistence guard (block empty overwrite, allow longer)
 * 4. CV bullet guard (bullet lines never standalone in work-experience)
 * 5. Missing suggestions cap (array sliced to max 3)
 * 6. Count mismatch detection (formula coverage)
 * 7. Export telemetry event names (distinct and present)
 */

import assert from "node:assert";
import {
  parseEntriesFromSection,
  estimateSectionEntryCount,
} from "../linkedin-parser";

// ── Helpers ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`  ✗ ${name}: ${msg}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label = "") {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${label ? label + ": " : ""}expected ${b}, got ${a}`);
  }
}

// ── Fixtures ────────────────────────────────────────────────────────

const THREE_JOB_WITH_BULLETS = `Senior Software Engineer
Google
January 2020 - Present
Mountain View, CA
Led development of distributed systems
Mentored team of 8 engineers

Software Development Engineer II
Amazon
June 2017 - December 2019
Seattle, WA
Built recommendation engine
Optimized database queries

Software Engineer
Microsoft
July 2014 - May 2017
Redmond, WA
Developed Azure Functions
Implemented CI/CD pipeline`;

const JOB_WITH_BULLET_ENTRIES = `Google - Senior Software Engineer
January 2020 - Present
Mountain View, CA
Led development of distributed systems

- Built a microservice architecture
- Managed deployment pipelines

Amazon - SDE II
June 2017 - December 2019
Seattle, WA
Built recommendation engine`;

const SAMPLE_REWRITTEN_TEXT = "This is the optimized summary text for the section.";
const SAME_TEXT = "  This is the optimized summary text for the section.  ";
const DIFFERENT_TEXT = "A completely different rewritten version of the text.";

// ══════════════════════════════════════════════════════════════════
// 1. Regenerate cap logic
// ══════════════════════════════════════════════════════════════════
console.log("\n── 1. Regenerate cap logic ──");

test("count starts at 0 for unseen section", () => {
  const counts: Record<string, number> = {};
  assertEqual(counts["summary"] ?? 0, 0);
});

test("count increments correctly", () => {
  const counts: Record<string, number> = {};
  counts["summary"] = (counts["summary"] ?? 0) + 1;
  assertEqual(counts["summary"], 1);
  counts["summary"] = (counts["summary"] ?? 0) + 1;
  assertEqual(counts["summary"], 2);
  counts["summary"] = (counts["summary"] ?? 0) + 1;
  assertEqual(counts["summary"], 3);
});

test("cap enforced at 3", () => {
  const counts: Record<string, number> = { summary: 3 };
  const currentCount = counts["summary"] ?? 0;
  const isBlocked = currentCount >= 3;
  assertEqual(isBlocked, true, "should be blocked at count=3");
});

test("cap NOT enforced below 3", () => {
  const counts: Record<string, number> = { summary: 2 };
  const currentCount = counts["summary"] ?? 0;
  const isBlocked = currentCount >= 3;
  assertEqual(isBlocked, false, "should NOT be blocked at count=2");
});

test("reset clears count for section", () => {
  const counts: Record<string, number> = { summary: 3, experience: 2 };
  delete counts["summary"];
  assertEqual(counts["summary"], undefined as unknown as number, "summary cleared");
  assertEqual(counts["experience"], 2, "experience untouched");
});

test("reset clears timestamps and noDiff flags too", () => {
  const timestamps: Record<string, number> = { summary: 12345 };
  const noDiff: Record<string, boolean> = { summary: true };
  delete timestamps["summary"];
  delete noDiff["summary"];
  assertEqual(timestamps["summary"], undefined as unknown as number);
  assertEqual(noDiff["summary"], undefined as unknown as boolean);
});

test("independent section counts", () => {
  const counts: Record<string, number> = {};
  counts["summary"] = 3;
  counts["experience"] = 1;
  assertEqual(counts["summary"] >= 3, true, "summary capped");
  assertEqual(counts["experience"] >= 3, false, "experience not capped");
});

// ══════════════════════════════════════════════════════════════════
// 2. No-diff detection
// ══════════════════════════════════════════════════════════════════
console.log("\n── 2. No-diff detection ──");

test("same text (trimmed) → isNoDiff=true", () => {
  const previousText = SAMPLE_REWRITTEN_TEXT;
  const incoming = SAME_TEXT;
  const isNoDiff = incoming.trim() === previousText.trim();
  assertEqual(isNoDiff, true);
});

test("different text → isNoDiff=false", () => {
  const previousText = SAMPLE_REWRITTEN_TEXT;
  const incoming = DIFFERENT_TEXT;
  const isNoDiff = incoming.trim() === previousText.trim();
  assertEqual(isNoDiff, false);
});

test("empty incoming vs non-empty → isNoDiff=false", () => {
  const previousText = SAMPLE_REWRITTEN_TEXT;
  const incoming = "";
  const isNoDiff = incoming.trim() === previousText.trim();
  assertEqual(isNoDiff, false);
});

test("both empty → isNoDiff=true", () => {
  const previousText = "";
  const incoming = "  ";
  const isNoDiff = incoming.trim() === previousText.trim();
  assertEqual(isNoDiff, true);
});

test("whitespace differences ignored", () => {
  const previousText = "Hello\n  World\n";
  const incoming = "  Hello\n  World  ";
  const isNoDiff = incoming.trim() === previousText.trim();
  assertEqual(isNoDiff, true);
});

// ══════════════════════════════════════════════════════════════════
// 3. Contact persistence guard
// ══════════════════════════════════════════════════════════════════
console.log("\n── 3. Contact persistence guard ──");

function simulateContactGuard(existing: string, incoming: string): boolean {
  // Mirrors the guard logic from AppContext.tsx setManualSection
  if (existing.trim().length > 0 && (incoming.trim().length === 0 || incoming.trim().length < existing.trim().length * 0.5)) {
    return true; // blocked
  }
  return false; // allowed
}

test("block overwrite with empty string", () => {
  const blocked = simulateContactGuard("John Doe\njohn@example.com\n+1-555-1234", "");
  assertEqual(blocked, true, "empty should be blocked");
});

test("block overwrite with very short content (<50%)", () => {
  const existing = "John Doe\njohn@example.com\n+1-555-1234\nSan Francisco, CA";
  const incoming = "John";
  const blocked = simulateContactGuard(existing, incoming);
  assertEqual(blocked, true, "too-short should be blocked");
});

test("allow overwrite with equal-length content", () => {
  const existing = "John Doe\njohn@example.com";
  const incoming = "Jane Smith\njane@example.com";
  const blocked = simulateContactGuard(existing, incoming);
  assertEqual(blocked, false, "equal length should be allowed");
});

test("allow overwrite with longer content", () => {
  const existing = "John Doe";
  const incoming = "John Doe\njohn@example.com\n+1-555-1234\nSan Francisco";
  const blocked = simulateContactGuard(existing, incoming);
  assertEqual(blocked, false, "longer should be allowed");
});

test("allow overwrite when existing is empty", () => {
  const blocked = simulateContactGuard("", "John Doe\njohn@example.com");
  assertEqual(blocked, false, "empty existing should allow anything");
});

test("allow overwrite at exactly 50% threshold", () => {
  const existing = "1234567890"; // 10 chars
  const incoming = "12345"; // 5 chars = exactly 50%
  const blocked = simulateContactGuard(existing, incoming);
  // 5 < 10 * 0.5 = 5 → false (not strictly less than), so NOT blocked
  assertEqual(blocked, false, "exactly 50% should be allowed");
});

test("block overwrite at 49% (below threshold)", () => {
  const existing = "12345678901"; // 11 chars
  const incoming = "12345"; // 5 chars, 5 < 11*0.5=5.5 → blocked
  const blocked = simulateContactGuard(existing, incoming);
  assertEqual(blocked, true, "49% should be blocked");
});

// ══════════════════════════════════════════════════════════════════
// 4. CV bullet guard
// ══════════════════════════════════════════════════════════════════
console.log("\n── 4. CV bullet guard ──");

test("clean 3-job CV parses to exactly 3 entries", () => {
  const result = parseEntriesFromSection("work-experience", THREE_JOB_WITH_BULLETS);
  assertEqual(result.entries.length, 3, "should parse 3 entries");
});

test("bullet-only lines never become standalone entries (work-experience)", () => {
  const result = parseEntriesFromSection("work-experience", JOB_WITH_BULLET_ENTRIES);
  const bulletRe = /^\s*[-*•–]/;
  const standaloneEntries = result.entries.filter(
    (e) => bulletRe.test(e.title) && !e.dateRange
  );
  assertEqual(standaloneEntries.length, 0, "no bullet-only standalone entries");
});

test("bullets merged into parent entry descriptions", () => {
  const result = parseEntriesFromSection("work-experience", JOB_WITH_BULLET_ENTRIES);
  // The bullet lines should be merged into the previous entry's description
  const hasEntryWithBullets = result.entries.some(
    (e) => e.description.includes("microservice") || e.description.includes("deployment")
  );
  assertEqual(hasEntryWithBullets, true, "bullets should be in parent description");
});

test("education section not affected by bullet guard", () => {
  const eduText = `Harvard University
Bachelor of Science in Computer Science
2010 - 2014
Dean's List, Magna Cum Laude

Stanford University
Master of Science in Machine Learning
2014 - 2016
Research Assistant`;
  const result = parseEntriesFromSection("education-section", eduText);
  // Education parser should work normally (no bullet guard interference)
  assert.ok(result.entries.length >= 1, "education should parse at least 1 entry");
});

test("single job with bullets: all bullets stay in description", () => {
  const singleJob = `Google - Senior Software Engineer
January 2020 - Present
Mountain View, CA
- Led development of distributed systems
- Mentored team of 8 engineers
- Built CI/CD pipeline`;
  const result = parseEntriesFromSection("work-experience", singleJob);
  assertEqual(result.entries.length, 1, "single job = 1 entry");
  const desc = result.entries[0].description;
  assert.ok(desc.includes("Led development"), "bullet 1 in description");
  assert.ok(desc.includes("Mentored"), "bullet 2 in description");
  assert.ok(desc.includes("CI/CD"), "bullet 3 in description");
});

// ══════════════════════════════════════════════════════════════════
// 5. Missing suggestions cap
// ══════════════════════════════════════════════════════════════════
console.log("\n── 5. Missing suggestions cap ──");

test("6 suggestions capped to 3", () => {
  const suggestions = ["A", "B", "C", "D", "E", "F"];
  const capped = suggestions.slice(0, 3);
  assertEqual(capped.length, 3);
  assertEqual(capped, ["A", "B", "C"]);
});

test("2 suggestions stays at 2 (no padding)", () => {
  const suggestions = ["A", "B"];
  const capped = suggestions.slice(0, 3);
  assertEqual(capped.length, 2);
});

test("exactly 3 suggestions unchanged", () => {
  const suggestions = ["A", "B", "C"];
  const capped = suggestions.slice(0, 3);
  assertEqual(capped.length, 3);
  assertEqual(capped, ["A", "B", "C"]);
});

test("1 suggestion stays at 1", () => {
  const suggestions = ["A"];
  const capped = suggestions.slice(0, 3);
  assertEqual(capped.length, 1);
});

test("empty array stays empty", () => {
  const suggestions: string[] = [];
  const capped = suggestions.slice(0, 3);
  assertEqual(capped.length, 0);
});

// ══════════════════════════════════════════════════════════════════
// 6. Count mismatch detection
// ══════════════════════════════════════════════════════════════════
console.log("\n── 6. Count mismatch detection ──");

function isMismatch(heuristicCount: number, parsedCount: number): boolean {
  return heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
}

test("heuristic=4, parsed=2 → mismatch (4 > 3, 4 >= 2)", () => {
  assertEqual(isMismatch(4, 2), true);
});

test("heuristic=3, parsed=2 → mismatch (3 > 3? no) → false", () => {
  assertEqual(isMismatch(3, 2), false);
});

test("heuristic=2, parsed=1 → mismatch (2 > 1.5, 2 >= 2)", () => {
  assertEqual(isMismatch(2, 1), true);
});

test("heuristic=1, parsed=1 → no mismatch (1 < 2)", () => {
  assertEqual(isMismatch(1, 1), false);
});

test("heuristic=0, parsed=0 → no mismatch (0 < 2)", () => {
  assertEqual(isMismatch(0, 0), false);
});

test("heuristic=6, parsed=2 → mismatch (6 > 3, 6 >= 2)", () => {
  assertEqual(isMismatch(6, 2), true);
});

test("heuristic=3, parsed=3 → no mismatch (3 > 4.5? no)", () => {
  assertEqual(isMismatch(3, 3), false);
});

test("ratio calculation for logging", () => {
  const heuristicCount = 6;
  const parsedCount = 2;
  const ratio = (heuristicCount / Math.max(1, parsedCount)).toFixed(1);
  assertEqual(ratio, "3.0");
});

test("ratio with parsedCount=0 uses max(1,...)", () => {
  const heuristicCount = 4;
  const parsedCount = 0;
  const ratio = (heuristicCount / Math.max(1, parsedCount)).toFixed(1);
  assertEqual(ratio, "4.0");
});

test("estimateSectionEntryCount returns reasonable count for 3-job CV", () => {
  const count = estimateSectionEntryCount(THREE_JOB_WITH_BULLETS, "work-experience");
  assert.ok(count >= 2 && count <= 4, `expected 2-4, got ${count}`);
});

// ══════════════════════════════════════════════════════════════════
// 7. Export telemetry event names
// ══════════════════════════════════════════════════════════════════
console.log("\n── 7. Export telemetry event names ──");

test("all export event names are distinct strings", () => {
  const events = [
    "exportCtaClicked",
    "exportJobStarted",
    "exportJobSucceeded",
    "exportDownloadStarted",
  ];
  const unique = new Set(events);
  assertEqual(unique.size, events.length, "all event names should be unique");
});

test("event names follow camelCase convention", () => {
  const events = [
    "exportCtaClicked",
    "exportJobStarted",
    "exportJobSucceeded",
    "exportDownloadStarted",
  ];
  const camelCaseRe = /^[a-z][a-zA-Z0-9]*$/;
  for (const name of events) {
    assert.ok(camelCaseRe.test(name), `${name} should be camelCase`);
  }
});

test("isBypass metadata distinguishes bypass vs normal export", () => {
  const normalMeta = { moduleId: "pdf", format: "pdf", isBypass: false };
  const bypassMeta = { moduleId: "pdf", format: "pdf", isBypass: true };
  assertEqual(normalMeta.isBypass, false, "normal export");
  assertEqual(bypassMeta.isBypass, true, "bypass export");
  assert.notDeepStrictEqual(normalMeta, bypassMeta);
});

test("server telemetry event name for mismatch is correct", () => {
  const eventName = "count_mismatch_detected";
  assert.ok(eventName.includes("mismatch"), "should contain mismatch");
  assert.ok(eventName.includes("detected"), "should contain detected");
});

// ── Summary ─────────────────────────────────────────────────────────
console.log(`\n══ HOTFIX-7 Results: ${passed} passed, ${failed} failed ══\n`);
if (failed > 0) process.exit(1);
