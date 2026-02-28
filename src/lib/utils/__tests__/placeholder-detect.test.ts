/**
 * Standalone tests for placeholder-detect.ts
 * Run: npx tsx src/lib/utils/__tests__/placeholder-detect.test.ts
 */

import {
  countPlaceholders,
  hasPlaceholders,
  countSectionPlaceholders,
  stripPlaceholders,
  sanitizeTemplateOutput,
} from "../placeholder-detect";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ── Test 1: [ADD_METRIC] ──
console.log("\nTest 1: [ADD_METRIC]");
assertEqual(countPlaceholders("Increased revenue by [ADD_METRIC] over Q3"), 1, "counts [ADD_METRIC]");
assert(hasPlaceholders("Increased revenue by [ADD_METRIC] over Q3"), "hasPlaceholders for [ADD_METRIC]");

// ── Test 2: [ADD_METRIC: dates] ──
console.log("\nTest 2: [ADD_METRIC: dates]");
assertEqual(countPlaceholders("Led team from [ADD_METRIC: start date] to [ADD_METRIC: end date]"), 2, "counts [ADD_METRIC: payload] twice");
assertEqual(countPlaceholders("Improved throughput by [ADD_METRIC: percentage increase]"), 1, "counts [ADD_METRIC: percentage increase]");
assert(hasPlaceholders("[ADD_METRIC: specific KPI value]"), "hasPlaceholders for [ADD_METRIC: payload]");

// ── Test 3: lowercase variants ──
console.log("\nTest 3: lowercase variants");
assertEqual(countPlaceholders("Revenue grew by [add_metric] in 2024"), 1, "counts lowercase [add_metric]");
assertEqual(countPlaceholders("[Add_Metric: dates] and [needs_verification]"), 2, "counts mixed-case variants");
assert(hasPlaceholders("[needs_verification]"), "hasPlaceholders for lowercase [needs_verification]");

// ── Test 4: entry-level placeholders only ──
console.log("\nTest 4: entry-level placeholders only (countSectionPlaceholders)");
{
  const rewrite = {
    sectionId: "work-experience",
    rewritten: "Clean section text with no placeholders",
    entries: [
      {
        entryTitle: "Entry A",
        original: "Original text A",
        rewritten: "Entry text with [ADD_METRIC: revenue growth] and [NEEDS_VERIFICATION]",
      },
      {
        entryTitle: "Entry B",
        original: "Original text B",
        rewritten: "Clean entry text with no issues",
      },
    ],
  };
  const userOptimized: Record<string, string> = {};
  const fakeStableId = (title: string, _original: string) => title.replace(/\s/g, "_");

  const result = countSectionPlaceholders(rewrite, userOptimized, undefined, fakeStableId);
  assertEqual(result.sectionCount, 0, "sectionCount is 0 (no placeholders in section text)");
  assertEqual(result.entryCount, 2, "entryCount is 2 (both placeholders in Entry A)");
  assertEqual(result.total, 2, "total is 2");
}

// ── Test 5: userOptimized overrides rewrite.rewritten ──
console.log("\nTest 5: userOptimized priority chain");
{
  const rewrite = {
    sectionId: "experience",
    rewritten: "Has [ADD_METRIC] placeholder",
    entries: [
      {
        entryTitle: "Job",
        original: "orig",
        rewritten: "Has [ADD_METRIC: KPI] here",
      },
    ],
  };
  // User cleared the placeholder in the entry
  const fakeStableId = (title: string, _original: string) => title;
  const userOptimized: Record<string, string> = {
    "experience:Job": "User replaced the entry text, no placeholders",
  };

  const result = countSectionPlaceholders(rewrite, userOptimized, undefined, fakeStableId);
  assertEqual(result.sectionCount, 1, "section-level placeholder still counted");
  assertEqual(result.entryCount, 0, "entry-level placeholder cleared by userOptimized");
  assertEqual(result.total, 1, "total = 1 after user edit");
}

// ── Test 6: stripPlaceholders ──
console.log("\nTest 6: stripPlaceholders");
{
  const input = "Grew revenue by [ADD_METRIC: percentage] in Q3.\n[NEEDS_VERIFICATION]\nNext line.";
  const stripped = stripPlaceholders(input);
  assert(!stripped.includes("[ADD_METRIC"), "stripped removes [ADD_METRIC: ...]");
  assert(!stripped.includes("[NEEDS_VERIFICATION]"), "stripped removes [NEEDS_VERIFICATION]");
  assert(stripped.includes("Grew revenue by"), "stripped keeps surrounding text");
  assert(stripped.includes("Next line"), "stripped keeps next line");
}

// ── Test 7: Non-placeholder brackets are NOT counted ──
console.log("\nTest 7: Non-placeholder brackets ignored");
assertEqual(countPlaceholders("[SKILLS SECTION]"), 0, "does not count [SKILLS SECTION]");
assertEqual(countPlaceholders("[React, Node.js]"), 0, "does not count [React, Node.js]");
assertEqual(countPlaceholders("[YOUR NAME HERE]"), 0, "does not count [YOUR NAME HERE]");
assert(!hasPlaceholders("[SOME RANDOM BRACKET TEXT]"), "hasPlaceholders false for random brackets");

// ── Test 8: Spaces inside brackets ──
console.log("\nTest 8: Internal spaces handled");
assertEqual(countPlaceholders("[ ADD_METRIC ]"), 1, "counts [ ADD_METRIC ] with spaces");
assertEqual(countPlaceholders("[ NEEDS_VERIFICATION ]"), 1, "counts [ NEEDS_VERIFICATION ] with spaces");
assertEqual(countPlaceholders("[ ADD_METRIC : revenue growth ]"), 1, "counts [ ADD_METRIC : payload ] with spaces");

// ── Test 9: sanitizeTemplateOutput removes orphan labels ──
console.log("\nTest 9: sanitizeTemplateOutput — orphan labels");
{
  const input = "John Doe\nEmail:\nPhone:\nNew York, NY";
  const result = sanitizeTemplateOutput(input);
  assert(!result.includes("Email:"), "removes orphan Email: label");
  assert(!result.includes("Phone:"), "removes orphan Phone: label");
  assert(result.includes("John Doe"), "keeps name");
  assert(result.includes("New York"), "keeps location");
}

// ── Test 10: sanitizeTemplateOutput removes dangling separators ──
console.log("\nTest 10: sanitizeTemplateOutput — dangling separators");
{
  const input = "john@example.com | \nSkills: Python, JS\nSome text |";
  const result = sanitizeTemplateOutput(input);
  assert(!result.includes("| "), "removes trailing pipe with space");
  assert(!result.endsWith("|"), "removes trailing pipe");
  assert(result.includes("Skills: Python, JS"), "keeps Skills line with content");
}

// ── Test 11: sanitizeTemplateOutput combines with placeholder removal ──
console.log("\nTest 11: sanitizeTemplateOutput — combined placeholder + orphan cleanup");
{
  const input = "Grew revenue by [ADD_METRIC: percentage].\nPhone:\n[NEEDS_VERIFICATION]\nReal content here.";
  const result = sanitizeTemplateOutput(input);
  assert(!result.includes("[ADD_METRIC"), "removes placeholder");
  assert(!result.includes("Phone:"), "removes orphan label");
  assert(!result.includes("[NEEDS_VERIFICATION]"), "removes verification placeholder");
  assert(result.includes("Real content here"), "keeps real content");
}

// ── Test 12: sanitizeTemplateOutput handles empty/null ──
console.log("\nTest 12: sanitizeTemplateOutput — edge cases");
{
  assertEqual(sanitizeTemplateOutput(""), "", "empty string returns empty");
  assertEqual(sanitizeTemplateOutput("Clean text"), "Clean text", "clean text unchanged");
  // Line with only separators
  const sepOnly = "First line\n | \nThird line";
  const result = sanitizeTemplateOutput(sepOnly);
  assert(!result.includes(" | "), "removes separator-only line");
  assert(result.includes("First line"), "keeps first line");
  assert(result.includes("Third line"), "keeps third line");
}

// ── Test 13: Placeholders removed in export output ──
console.log("\nTest 13: Placeholders completely removed in export output");
{
  const exportText = "Led team of [ADD_METRIC: team size] engineers.\nDelivered [ADD_METRIC: project count] projects on time.\n[NEEDS_VERIFICATION]\nProven track record.";
  const cleaned = sanitizeTemplateOutput(exportText);
  assertEqual(countPlaceholders(cleaned), 0, "zero placeholders after sanitize");
  assert(cleaned.includes("Led team of"), "keeps surrounding content");
  assert(cleaned.includes("Proven track record"), "keeps non-placeholder content");
}

// ── Test 14: Non-placeholder tokens NOT counted (extended) ──
console.log("\nTest 14: Non-placeholder tokens untouched by sanitize");
{
  const text = "Technologies: [React, Node.js, Python]\nFramework [INTERNAL] discussion";
  const cleaned = sanitizeTemplateOutput(text);
  assert(cleaned.includes("[React, Node.js, Python]"), "keeps tech stack brackets");
  assert(cleaned.includes("[INTERNAL]"), "keeps non-placeholder brackets");
}

// ── Summary ──
console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed!");
}
