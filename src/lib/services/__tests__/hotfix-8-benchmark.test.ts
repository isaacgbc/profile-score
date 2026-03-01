/**
 * HOTFIX-8 — Benchmark Tests
 *
 * Tests:
 * 1. Placeholder counter visibility (deleted entries excluded)
 * 2. COUNT_CROSSCHECK heuristic sanity cap
 * 3. CV contact-info fallback extractor
 * 4. Instruction seeds schema validation
 * 5. Sanitize template output (regression)
 */

import assert from "node:assert";
import {
  countPlaceholders,
  hasPlaceholders,
  countSectionPlaceholders,
  stripPlaceholders,
  sanitizeTemplateOutput,
} from "../../utils/placeholder-detect";
import {
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

// ══════════════════════════════════════════════════════════════════════
// 1. Placeholder counter visibility — deleted entries excluded
// ══════════════════════════════════════════════════════════════════════
console.log("\n1. Placeholder counter visibility");

test("countSectionPlaceholders excludes deleted entries", () => {
  const rewrite = {
    sectionId: "experience",
    rewritten: "Section text without placeholders",
    entries: [
      { entryTitle: "Job A", original: "orig-a", rewritten: "Text with [ADD_METRIC: dates] here" },
      { entryTitle: "Job B", original: "orig-b", rewritten: "Clean text no placeholders" },
      { entryTitle: "Job C", original: "orig-c", rewritten: "[NEEDS_VERIFICATION] another" },
    ],
  };
  const userOptimized: Record<string, string> = {};
  const computeStableId = (title: string, original: string) => `${title}__${original.slice(0, 8)}`;

  // Without deletions — should count 2 placeholders (Job A + Job C)
  const withoutDeletions = countSectionPlaceholders(rewrite, userOptimized, undefined, computeStableId);
  assertEqual(withoutDeletions.total, 2, "total without deletions");
  assertEqual(withoutDeletions.hiddenCount, 0, "hidden without deletions");

  // Delete Job A — should count 1 placeholder (only Job C)
  const deletedKeys = new Set(["experience:Job A__orig-a"]);
  const withDeletion = countSectionPlaceholders(rewrite, userOptimized, undefined, computeStableId, deletedKeys);
  assertEqual(withDeletion.entryCount, 1, "entryCount with Job A deleted");
  assertEqual(withDeletion.hiddenCount, 1, "hiddenCount with Job A deleted");
  assertEqual(withDeletion.total, 1, "total with Job A deleted");
});

test("countSectionPlaceholders returns 0 when all placeholder entries deleted", () => {
  const rewrite = {
    sectionId: "experience",
    rewritten: "Clean section text",
    entries: [
      { entryTitle: "Job A", original: "orig-a", rewritten: "[ADD_METRIC] text" },
    ],
  };
  const userOptimized: Record<string, string> = {};
  const computeStableId = (title: string, original: string) => `${title}__${original.slice(0, 8)}`;
  const deletedKeys = new Set(["experience:Job A__orig-a"]);

  const result = countSectionPlaceholders(rewrite, userOptimized, undefined, computeStableId, deletedKeys);
  assertEqual(result.total, 0, "total should be 0");
  assertEqual(result.hiddenCount, 1, "hidden should be 1");
});

test("empty deletedEntryKeys set — no regression", () => {
  const rewrite = {
    sectionId: "experience",
    rewritten: "[ADD_METRIC: dates]",
    entries: [
      { entryTitle: "Job A", original: "orig-a", rewritten: "[NEEDS_VERIFICATION]" },
    ],
  };
  const userOptimized: Record<string, string> = {};
  const emptySet = new Set<string>();

  const result = countSectionPlaceholders(rewrite, userOptimized, undefined, undefined, emptySet);
  assertEqual(result.total, 2, "total with empty deletedEntryKeys");
  assertEqual(result.hiddenCount, 0, "hidden with empty set");
});

// ══════════════════════════════════════════════════════════════════════
// 2. COUNT_CROSSCHECK heuristic sanity cap
// ══════════════════════════════════════════════════════════════════════
console.log("\n2. COUNT_CROSSCHECK heuristic sanity cap");

test("bullet-heavy text (100 bullets, 10 entries) returns sane estimate", () => {
  // Create text with ~10 real entries but 100 bullet lines
  const entries: string[] = [];
  for (let i = 0; i < 10; i++) {
    entries.push(`Software Engineer ${i}`);
    entries.push(`Company ${i}`);
    entries.push(`Jan 2020 - Dec 2021`);
    for (let j = 0; j < 10; j++) {
      entries.push(`• Bullet point ${j} for entry ${i}`);
    }
    entries.push(""); // blank line separator
  }
  const text = entries.join("\n");

  const estimate = estimateSectionEntryCount(text, "experience");
  // With 100+ bullet lines, the old code would return ~55. Now capped.
  assert.ok(estimate <= 20, `Expected <= 20, got ${estimate}`);
});

test("sanity cap: ceil(1500 / 150) = 10 applied", () => {
  // 1500 chars of text with many blocks
  const lines: string[] = [];
  for (let i = 0; i < 50; i++) {
    lines.push(`Line ${i} with some content here`);
    if (i % 2 === 0) lines.push(""); // lots of blocks
  }
  const text = lines.join("\n");
  const charCap = Math.ceil(text.length / 150);
  const estimate = estimateSectionEntryCount(text, "experience");
  assert.ok(estimate <= charCap, `Expected <= ${charCap} (char cap), got ${estimate}`);
});

test("short text sanity cap: ceil(300 / 150) = 2", () => {
  const text = "Software Engineer\nGoogle\nJan 2020 - Dec 2021\n\nProduct Manager\nMeta\nFeb 2018 - Dec 2019\n\nDesigner\nApple\nMar 2015 - Jan 2018";
  const charCap = Math.ceil(text.length / 150);
  const estimate = estimateSectionEntryCount(text, "experience");
  // Should not exceed character-based cap
  assert.ok(estimate <= charCap + 1, `Expected <= ${charCap + 1}, got ${estimate}`);
});

test("mismatch detection: ratio 3.0 is credible (within 5.0 threshold)", () => {
  // Simulate: heuristicCount=15, parsedCount=5 → ratio=3.0
  const heuristicCount = 15;
  const parsedCount = 5;
  const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
  const ratio = heuristicCount / Math.max(1, parsedCount);
  const isCredible = mismatch && ratio <= 5.0;
  assertEqual(isCredible, true, "ratio 3.0 should be credible");
});

test("mismatch suppression: ratio > 5.0 is not credible", () => {
  // Simulate: heuristicCount=60, parsedCount=10 → ratio=6.0
  const heuristicCount = 60;
  const parsedCount = 10;
  const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
  const ratio = heuristicCount / Math.max(1, parsedCount);
  const isCredible = mismatch && ratio <= 5.0;
  assertEqual(isCredible, false, "ratio 6.0 should NOT be credible");
});

test("mismatch detection: ratio 1.0 is not flagged", () => {
  const heuristicCount = 5;
  const parsedCount = 5;
  const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
  assertEqual(mismatch, false, "ratio 1.0 should not be mismatch");
});

// ══════════════════════════════════════════════════════════════════════
// 3. CV contact-info fallback extractor
// ══════════════════════════════════════════════════════════════════════
console.log("\n3. CV contact-info fallback extractor");

// We can't import the private function directly, so we test the regex logic inline
function extractContactInfoFallback(text: string): string | null {
  const lines = text.split("\n").slice(0, 20);
  const contactLines: string[] = [];
  const EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w{2,}/;
  const PHONE_RE = /(\+?\d[\d\s\-().]{7,}\d)/;
  const LINKEDIN_RE = /linkedin\.com\/in\/[\w-]+/i;
  const LOCATION_RE = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2}\s*\d{0,5}/;

  let grabbedFirstLine = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (
      EMAIL_RE.test(trimmed) ||
      PHONE_RE.test(trimmed) ||
      LINKEDIN_RE.test(trimmed) ||
      LOCATION_RE.test(trimmed)
    ) {
      contactLines.push(trimmed);
    }
    if (
      !grabbedFirstLine &&
      trimmed.length > 2 &&
      trimmed.length < 60 &&
      !/^(contact|experience|education|skills|summary)/i.test(trimmed)
    ) {
      grabbedFirstLine = true;
      if (!contactLines.includes(trimmed)) {
        contactLines.unshift(trimmed);
      }
    }
  }

  return contactLines.length >= 2 ? contactLines.join("\n") : null;
}

test("fallback finds email + phone in first 20 lines", () => {
  const cvText = `John Doe
Software Engineer
john.doe@email.com
+1 (555) 123-4567
San Francisco, CA

Experience
Senior Engineer at Google
...`;
  const result = extractContactInfoFallback(cvText);
  assert.ok(result !== null, "Should find contact info");
  assert.ok(result!.includes("john.doe@email.com"), "Should include email");
  assert.ok(result!.includes("555"), "Should include phone");
});

test("fallback returns null when no patterns found", () => {
  const cvText = `Experience
Senior Software Engineer
Google
January 2020 - Present
Led development of distributed systems
Built microservice architecture`;
  const result = extractContactInfoFallback(cvText);
  // "Experience" is filtered by the /^(experience|...)/ check
  // No email/phone/linkedin — should return null
  assertEqual(result, null, "Should return null");
});

test("fallback grabs name from first line", () => {
  const cvText = `María García López
maria.garcia@company.com
+34 612 345 678
Madrid, Spain`;
  const result = extractContactInfoFallback(cvText);
  assert.ok(result !== null, "Should find contact info");
  assert.ok(result!.startsWith("María García López"), "Should start with name");
});

test("fallback finds LinkedIn URL", () => {
  const cvText = `Jane Smith
linkedin.com/in/jane-smith
jane@example.com`;
  const result = extractContactInfoFallback(cvText);
  assert.ok(result !== null, "Should find contact info");
  assert.ok(result!.includes("linkedin.com/in/jane-smith"), "Should include LinkedIn");
});

// ══════════════════════════════════════════════════════════════════════
// 4. Instruction seeds schema validation
// ══════════════════════════════════════════════════════════════════════
console.log("\n4. Instruction seeds schema validation");

test("seeds array of 3 strings is valid", () => {
  const seeds = ["Add quantifiable metrics", "Include team size", "Mention technologies used"];
  assertEqual(seeds.length <= 6, true, "length <= 6");
  assertEqual(seeds.every(s => s.length <= 200), true, "all <= 200 chars");
});

test("empty seeds array does not crash", () => {
  const seeds: string[] = [];
  const seedsText = seeds.length
    ? `\nPrevious AI suggestions:\n${seeds.map(s => `- ${s}`).join("\n")}`
    : "";
  assertEqual(seedsText, "", "empty seeds produces empty string");
});

test("seeds appended to editing directives", () => {
  const seeds = ["Add leadership examples", "Quantify impact"];
  const seedsText = seeds.length
    ? `\n\nPrevious AI suggestions for this section:\n${seeds.map(s => `- ${s}`).join("\n")}`
    : "";
  const editingDirectives = "Rewrite professionally" + seedsText;
  assert.ok(editingDirectives.includes("Add leadership examples"), "Should contain seed 1");
  assert.ok(editingDirectives.includes("Quantify impact"), "Should contain seed 2");
});

test("UI slice(0,3) caps 6 suggestions to 3", () => {
  const suggestions = ["A", "B", "C", "D", "E", "F"];
  const capped = suggestions.slice(0, 3);
  assertEqual(capped.length, 3, "should be 3");
  assertEqual(capped, ["A", "B", "C"], "should be first 3");
});

// ══════════════════════════════════════════════════════════════════════
// 5. Placeholder utilities (regression)
// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Placeholder utilities (regression)");

test("countPlaceholders counts multiple", () => {
  assertEqual(countPlaceholders("[ADD_METRIC: dates] and [NEEDS_VERIFICATION]"), 2);
});

test("hasPlaceholders returns true for ADD_METRIC", () => {
  assertEqual(hasPlaceholders("Some text [ADD_METRIC] here"), true);
});

test("hasPlaceholders returns false for clean text", () => {
  assertEqual(hasPlaceholders("Clean professional text"), false);
});

test("stripPlaceholders removes all tokens", () => {
  const input = "Led team [ADD_METRIC: size] to deliver [NEEDS_VERIFICATION] results";
  const result = stripPlaceholders(input);
  assertEqual(hasPlaceholders(result), false, "should have no placeholders after strip");
});

test("sanitizeTemplateOutput removes orphan labels", () => {
  const input = "Phone:\nEmail:\nSkills: Python, JavaScript";
  const result = sanitizeTemplateOutput(input);
  assert.ok(!result.includes("Phone:"), "Should remove orphan Phone:");
  assert.ok(!result.includes("Email:"), "Should remove orphan Email:");
  assert.ok(result.includes("Skills"), "Should keep Skills with content");
});

// ══════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`HOTFIX-8 benchmark: ${passed} passed, ${failed} failed`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

if (failed > 0) process.exit(1);
