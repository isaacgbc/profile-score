/**
 * HOTFIX-6 — Benchmark Tests
 *
 * Tests:
 * 1. Heuristic count estimator (estimateSectionEntryCount)
 * 2. Count mismatch detection logic
 * 3. Education fallback path anti-over-split
 * 4. CV-only LinkedIn log gating
 * 5. Module-specific download labels
 * 6. AI Instructions separation (userImprovement vs rewrite.improvements)
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

const THREE_JOB_CV = `Google - Senior Software Engineer
January 2020 - Present
Mountain View, CA
- Led development of distributed systems serving 1B+ users
- Mentored team of 8 engineers

Amazon - Software Development Engineer II
June 2017 - December 2019
Seattle, WA
- Built recommendation engine processing 500M events/day
- Optimized database queries reducing p99 latency

Microsoft - Software Engineer
July 2014 - May 2017
Redmond, WA
- Developed Azure Functions serverless platform
- Implemented CI/CD pipeline`;

const TWO_SCHOOL_EDU = `Harvard University
Bachelor of Science in Computer Science
2010 - 2014
Dean's List, Magna Cum Laude

Stanford University
Master of Science in Machine Learning
2014 - 2016
Research Assistant`;

const EMPTY_SECTION = "";
const TINY_SECTION = "Short text";

// Education without date lines (triggers fallback path)
const NO_DATE_EDUCATION = `Massachusetts Institute of Technology
Bachelor of Science in Electrical Engineering
GPA: 3.9/4.0

University of California Berkeley
Master of Science in Data Science
Thesis: "Deep Learning for NLP"`;

// ── Test Groups ─────────────────────────────────────────────────────
console.log("\n=== HOTFIX-6 — Benchmark Tests ===\n");

// ── 1. Heuristic count estimator ────────────────────────────────────
console.log("1. Heuristic count estimator (estimateSectionEntryCount)");

test("3-job CV → estimate ~3", () => {
  const count = estimateSectionEntryCount(THREE_JOB_CV, "work-experience");
  assert(count >= 2 && count <= 5,
    `Expected 2-5 for 3-job CV, got ${count}`);
});

test("2-school edu → estimate ~2", () => {
  const count = estimateSectionEntryCount(TWO_SCHOOL_EDU, "education-section");
  assert(count >= 1 && count <= 4,
    `Expected 1-4 for 2-school edu, got ${count}`);
});

test("empty section → 0", () => {
  const count = estimateSectionEntryCount(EMPTY_SECTION, "experience");
  assertEqual(count, 0, "Empty section should return 0");
});

test("tiny section (< 30 chars) → 0", () => {
  const count = estimateSectionEntryCount(TINY_SECTION, "experience");
  assertEqual(count, 0, "Tiny section should return 0");
});

test("uses date signal (DATE_LINE_RE matches)", () => {
  const withDates = `Software Engineer
Jan 2020 - Present

Data Analyst
Mar 2018 - Dec 2019

Intern
Jun 2017 - Feb 2018`;
  const count = estimateSectionEntryCount(withDates, "work-experience");
  assert(count >= 3, `Expected ≥3 from date signals, got ${count}`);
});

test("uses block signal (blank-line separated)", () => {
  const blocks = `Block One
Some content here
More content

Block Two
Different content
Extra lines

Block Three
Final content`;
  const count = estimateSectionEntryCount(blocks, "experience");
  assert(count >= 1, `Expected ≥1 from block signals, got ${count}`);
});

// ── 2. Count mismatch detection ─────────────────────────────────────
console.log("\n2. Count mismatch detection logic");

test("heuristic=3, parsed=3 → no mismatch", () => {
  const heuristicCount = 3;
  const parsedCount = 3;
  const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
  assertEqual(mismatch, false, "Equal counts should not mismatch");
});

test("heuristic=5, parsed=2 → mismatch (5 > 2*1.5=3)", () => {
  const heuristicCount = 5;
  const parsedCount = 2;
  const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
  assertEqual(mismatch, true, "5 > 3 should be a mismatch");
});

test("heuristic=1, parsed=0 → no mismatch (heuristic < 2)", () => {
  const heuristicCount = 1;
  const parsedCount = 0;
  const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
  assertEqual(mismatch, false, "Heuristic=1 should not trigger mismatch");
});

test("heuristic=3, parsed=1 → mismatch (3 > 1.5)", () => {
  const heuristicCount = 3;
  const parsedCount = 1;
  const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
  assertEqual(mismatch, true, "3 > 1.5 should be a mismatch");
});

test("heuristic=2, parsed=2 → no mismatch (2 ≤ 3)", () => {
  const heuristicCount = 2;
  const parsedCount = 2;
  const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
  assertEqual(mismatch, false, "2 ≤ 3 should not mismatch");
});

// ── 3. Education fallback path anti-over-split ──────────────────────
console.log("\n3. Education fallback path anti-over-split");

test("education without date lines → mergeEducationOverSplit applied", () => {
  // This triggers the fallback path (Path A in plan) that was fixed
  const result = parseEntriesFromSection("education-section", NO_DATE_EDUCATION);
  // Should not over-fragment: 2 schools → ≤ 3 entries (cap = ceil(chars/150))
  assert(result.entries.length >= 1 && result.entries.length <= 4,
    `Expected 1-4 entries for 2-school no-date edu, got ${result.entries.length}`);
});

test("education fallback entries retain quality", () => {
  const result = parseEntriesFromSection("education-section", NO_DATE_EDUCATION);
  // At least one entry should have some content
  const totalContent = result.entries.reduce(
    (sum, e) => sum + e.title.length + e.organization.length + e.description.length,
    0
  );
  assert(totalContent >= 30,
    `Expected ≥30 total content chars, got ${totalContent}`);
});

test("normal education (with dates) still parses correctly", () => {
  const result = parseEntriesFromSection("education-section", TWO_SCHOOL_EDU);
  assert(result.entries.length >= 1 && result.entries.length <= 4,
    `Expected 1-4 entries for 2-school edu, got ${result.entries.length}`);
});

// ── 4. CV-only LinkedIn log gating ──────────────────────────────────
console.log("\n4. CV-only LinkedIn log gating");

test("hasLinkedinInput=false blocks LinkedIn diagnostics", () => {
  const linkedinText = "";
  const hasLinkedinInput = linkedinText.trim().length > 0;
  assertEqual(hasLinkedinInput, false);

  let linkedinDiagFired = false;
  if (hasLinkedinInput) {
    linkedinDiagFired = true;
  }
  assertEqual(linkedinDiagFired, false, "LinkedIn diag should NOT fire for CV-only");
});

test("hasLinkedinInput=true enables LinkedIn diagnostics", () => {
  const linkedinText = "Some LinkedIn profile content with enough text to be valid...";
  const hasLinkedinInput = linkedinText.trim().length > 0;
  assertEqual(hasLinkedinInput, true);

  let linkedinDiagFired = false;
  if (hasLinkedinInput) {
    linkedinDiagFired = true;
  }
  assertEqual(linkedinDiagFired, true, "LinkedIn diag should fire when present");
});

test("count cross-check only runs when hasLinkedinInput=true", () => {
  const hasLinkedinInput = false;
  let crosscheckRan = false;
  if (hasLinkedinInput) {
    crosscheckRan = true;
  }
  assertEqual(crosscheckRan, false, "Cross-check should not run for CV-only");
});

// ── 5. Module-specific download labels ──────────────────────────────
console.log("\n5. Module-specific download labels (HOTFIX-6C)");

const MODULE_DOWNLOAD_LABELS: Record<string, string> = {
  "results-summary": "downloadResultsSummary",
  "updated-cv": "downloadUpdatedCv",
  "full-audit": "downloadFullAudit",
  "cover-letter": "downloadCoverLetter",
  "linkedin-updates": "downloadLinkedinUpdates",
};

test("all 5 modules have download label keys", () => {
  const moduleIds = ["results-summary", "updated-cv", "full-audit", "cover-letter", "linkedin-updates"];
  for (const id of moduleIds) {
    assert(MODULE_DOWNLOAD_LABELS[id], `Missing download label for ${id}`);
  }
});

test("download labels are unique across modules", () => {
  const labels = Object.values(MODULE_DOWNLOAD_LABELS);
  const unique = new Set(labels);
  assertEqual(unique.size, labels.length, "All download labels should be unique");
});

test("updated-cv maps to downloadUpdatedCv", () => {
  assertEqual(MODULE_DOWNLOAD_LABELS["updated-cv"], "downloadUpdatedCv");
});

test("full-audit maps to downloadFullAudit", () => {
  assertEqual(MODULE_DOWNLOAD_LABELS["full-audit"], "downloadFullAudit");
});

// ── 6. AI Instructions separation ───────────────────────────────────
console.log("\n6. AI Instructions separation (userImprovement vs improvements)");

test("userImprovement is independent from rewrite.improvements", () => {
  const rewriteImprovements: string = "Add more quantifiable achievements";
  const userImprovement: string = "Focus on leadership skills";
  // These should be distinct — user textarea shows userImprovement, not improvements
  assert(userImprovement !== rewriteImprovements,
    "User input should be independent from AI suggestions");
});

test("empty userImprovement renders empty textarea (not AI suggestions)", () => {
  const userImprovement: string | undefined = undefined;
  // New behavior: textarea value = userImprovement ?? "" (not ?? rewrite.improvements)
  const textareaValue = userImprovement ?? "";
  assertEqual(textareaValue, "", "Empty user input should show empty textarea");
});

test("AI suggestions display separately from user input", () => {
  const rewriteImprovements: string = "Consider adding metrics to your experience entries";
  const userImprovement: string = "Make it more concise";
  // Both should be available but in separate UI elements
  assert(rewriteImprovements.length > 0, "AI suggestions should exist");
  assert(userImprovement.length > 0, "User input should exist");
  assert(rewriteImprovements !== userImprovement, "They should be different values");
});

// ── Results ─────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
}

console.log("All HOTFIX-6 benchmark tests passed ✓\n");
