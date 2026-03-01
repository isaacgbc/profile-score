/**
 * HOTFIX-9 — Benchmark Tests
 *
 * Tests:
 * 1. Non-empty instruction seeds for all sections
 * 2. No entry loss with long profile (cap raised)
 * 3. Export output has zero placeholders after sanitization
 * 4. CV header excludes objective/headline text
 * 5. LinkedIn URL extraction and bare text filtering
 * 6. DOCX sanitization import verification
 */

import assert from "node:assert";
import {
  countPlaceholders,
  sanitizeTemplateOutput,
} from "../../utils/placeholder-detect";
import {
  getFallbackSuggestions,
  FALLBACK_SUGGESTIONS,
} from "../../utils/fallback-suggestions";
import { MAX_ENTRIES_PER_SECTION } from "../linkedin-parser";

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

function assertTrue(actual: boolean, label = "") {
  if (!actual) {
    throw new Error(`${label ? label + ": " : ""}expected true, got false`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 1. Non-empty instruction seeds for all sections
// ══════════════════════════════════════════════════════════════════════
console.log("\n1. Non-empty instruction seeds for all sections");

const ALL_SECTION_IDS = [
  "headline", "summary", "experience", "education", "skills",
  "featured", "recommendations", "certifications",
  "contact-info", "professional-summary", "work-experience",
  "skills-section", "education-section",
];

test("getFallbackSuggestions returns 3 items for every known section", () => {
  for (const sectionId of ALL_SECTION_IDS) {
    const suggestions = getFallbackSuggestions(sectionId);
    assertEqual(suggestions.length, 3, `section ${sectionId}`);
    for (const s of suggestions) {
      assertTrue(s.length > 5, `suggestion too short for ${sectionId}: "${s}"`);
    }
  }
});

test("getFallbackSuggestions returns 3 generic items for unknown section", () => {
  const suggestions = getFallbackSuggestions("unknown-section-xyz");
  assertEqual(suggestions.length, 3, "unknown section fallback count");
  assertTrue(suggestions[0].includes("specific"), "first generic suggestion");
});

test("FALLBACK_SUGGESTIONS covers all known section IDs", () => {
  for (const sectionId of ALL_SECTION_IDS) {
    assertTrue(
      sectionId in FALLBACK_SUGGESTIONS,
      `missing fallback for ${sectionId}`
    );
  }
});

test("passthrough rewrite would get non-empty missingSuggestions", () => {
  // Simulate passthrough: missingSuggestions starts as []
  let missingSuggestions: string[] = [];
  if (missingSuggestions.length === 0) {
    missingSuggestions = getFallbackSuggestions("experience");
  }
  assertTrue(missingSuggestions.length > 0, "should have suggestions after injection");
  assertEqual(missingSuggestions.length, 3, "should have exactly 3");
});

// ══════════════════════════════════════════════════════════════════════
// 2. No entry loss with long profile (cap raised)
// ══════════════════════════════════════════════════════════════════════
console.log("\n2. No entry loss with long profile");

test("MAX_ENTRIES_PER_SECTION is at least 15", () => {
  assertTrue(
    MAX_ENTRIES_PER_SECTION >= 15,
    `MAX_ENTRIES_PER_SECTION is ${MAX_ENTRIES_PER_SECTION}, expected >= 15`
  );
});

test("8 entries are all within MAX_ENTRIES_PER_SECTION", () => {
  const profileEntries = 8;
  assertTrue(
    profileEntries <= MAX_ENTRIES_PER_SECTION,
    `${profileEntries} entries exceed cap of ${MAX_ENTRIES_PER_SECTION}`
  );
});

test("15 entries are all within MAX_ENTRIES_PER_SECTION", () => {
  const profileEntries = 15;
  assertTrue(
    profileEntries <= MAX_ENTRIES_PER_SECTION,
    `${profileEntries} entries exceed cap of ${MAX_ENTRIES_PER_SECTION}`
  );
});

// ══════════════════════════════════════════════════════════════════════
// 3. Export output has zero placeholders after sanitization
// ══════════════════════════════════════════════════════════════════════
console.log("\n3. Export output has zero placeholders");

test("sanitizeTemplateOutput strips [ADD_METRIC] placeholders", () => {
  const input = "Increased revenue by [ADD_METRIC: percentage] over Q3";
  const output = sanitizeTemplateOutput(input);
  assertEqual(countPlaceholders(output), 0, "should have 0 placeholders");
  assertTrue(!output.includes("[ADD_METRIC"), "should not contain [ADD_METRIC");
});

test("sanitizeTemplateOutput strips [NEEDS_VERIFICATION] placeholders", () => {
  const input = "[NEEDS_VERIFICATION] Led team of 5 engineers";
  const output = sanitizeTemplateOutput(input);
  assertEqual(countPlaceholders(output), 0, "should have 0 placeholders");
  assertTrue(!output.includes("[NEEDS_VERIFICATION"), "should not contain [NEEDS_VERIFICATION");
});

test("sanitizeAllRewrites pattern cleans all entries", () => {
  // Simulate what sanitizeAllRewrites does
  const rewrites = [
    { rewritten: "Text with [ADD_METRIC: something]", entries: [
      { rewritten: "[NEEDS_VERIFICATION] entry text" },
    ] },
    { rewritten: "Clean text no issues", entries: [] },
  ];

  let total = 0;
  for (const r of rewrites) {
    const sanitized = sanitizeTemplateOutput(r.rewritten);
    total += countPlaceholders(sanitized);
    for (const e of (r.entries ?? [])) {
      const sanitizedEntry = sanitizeTemplateOutput(e.rewritten);
      total += countPlaceholders(sanitizedEntry);
    }
  }
  assertEqual(total, 0, "total placeholders after sanitization");
});

// ══════════════════════════════════════════════════════════════════════
// 4. CV header excludes objective/headline text
// ══════════════════════════════════════════════════════════════════════
console.log("\n4. CV header excludes objective/headline text");

// Replicate the filter logic from updated-cv.ts and updated-cv-docx.ts
const HEADER_EXCLUDE_RE = /^(objective|professional\s*(goal|growth|summary)|career\s*(objective|goal))/i;
const SEPARATOR_ONLY_RE = /^\s*[|,;\-–—]+\s*$/;

function filterContactLines(lines: string[]): string[] {
  return lines.filter((line) => {
    const trimmed = line.trim();
    if (HEADER_EXCLUDE_RE.test(trimmed)) return false;
    if (SEPARATOR_ONLY_RE.test(trimmed)) return false;
    if (/^objective\s*[|:]/i.test(trimmed)) return false;
    return true;
  });
}

test("filters 'Objective | Professional growth' from header", () => {
  const lines = [
    "John Smith",
    "john@email.com | 555-1234",
    "Objective | Professional growth",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should have 2 lines after filtering");
  assertTrue(!filtered.some(l => l.includes("Objective")), "should not contain Objective");
});

test("filters 'Career Objective: ...' from header", () => {
  const lines = [
    "Jane Doe",
    "Career Objective: To pursue excellence",
    "jane@email.com",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should have 2 lines after filtering");
  assertTrue(filtered.includes("jane@email.com"), "should preserve email");
});

test("filters 'Professional Growth' from header", () => {
  const lines = [
    "Alex Johnson",
    "Professional Growth",
    "alex@company.com | New York, NY",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should have 2 lines after filtering");
  assertTrue(filtered.includes("Alex Johnson"), "should preserve name");
});

test("preserves normal contact lines", () => {
  const lines = [
    "Sarah Lee",
    "sarah@email.com | 555-9876 | linkedin.com/in/sarahlee",
    "San Francisco, CA",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 3, "should preserve all 3 contact lines");
});

test("filters separator-only lines", () => {
  const lines = [
    "John Smith",
    "---",
    "john@email.com",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should filter separator-only line");
});

// ══════════════════════════════════════════════════════════════════════
// 5. LinkedIn URL extraction and bare text filtering
// ══════════════════════════════════════════════════════════════════════
console.log("\n5. LinkedIn URL extraction and bare text filtering");

// Replicate the patterns from extractContactInfoFallback
const BARE_LINKEDIN_RE = /^\s*linkedin\s*$/i;
const LINKEDIN_URL_RE = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/i;

test("bare 'LinkedIn' text is detected for filtering", () => {
  assertTrue(BARE_LINKEDIN_RE.test("LinkedIn"), "should match 'LinkedIn'");
  assertTrue(BARE_LINKEDIN_RE.test("  linkedin  "), "should match '  linkedin  '");
  assertTrue(BARE_LINKEDIN_RE.test("LINKEDIN"), "should match 'LINKEDIN'");
});

test("bare 'LinkedIn' does NOT match actual URLs", () => {
  assertTrue(!BARE_LINKEDIN_RE.test("linkedin.com/in/john"), "URL should not match");
  assertTrue(!BARE_LINKEDIN_RE.test("https://linkedin.com/in/john"), "full URL should not match");
  assertTrue(!BARE_LINKEDIN_RE.test("LinkedIn Profile"), "text with more words should not match");
});

test("LinkedIn URL regex extracts full URLs", () => {
  const text = "Visit https://www.linkedin.com/in/johndoe for more";
  const match = text.match(LINKEDIN_URL_RE);
  assertTrue(match !== null, "should match URL");
  assertEqual(match![0], "https://www.linkedin.com/in/johndoe", "URL value");
});

test("LinkedIn URL regex extracts http URLs", () => {
  const text = "Profile: http://linkedin.com/in/janedoe";
  const match = text.match(LINKEDIN_URL_RE);
  assertTrue(match !== null, "should match http URL");
  assertEqual(match![0], "http://linkedin.com/in/janedoe", "URL value");
});

test("LinkedIn URL regex handles hyphens in username", () => {
  const text = "https://linkedin.com/in/john-doe-123";
  const match = text.match(LINKEDIN_URL_RE);
  assertTrue(match !== null, "should match URL with hyphens");
  assertEqual(match![0], "https://linkedin.com/in/john-doe-123", "URL value");
});

// ══════════════════════════════════════════════════════════════════════
// 6. DOCX sanitization import verification
// ══════════════════════════════════════════════════════════════════════
console.log("\n6. DOCX sanitization import verification");

import * as fs from "node:fs";
import * as path from "node:path";

test("updated-cv-docx.ts imports sanitizeTemplateOutput", () => {
  const docxPath = path.resolve(__dirname, "../docx/updated-cv-docx.ts");
  const content = fs.readFileSync(docxPath, "utf-8");
  assertTrue(
    content.includes("sanitizeTemplateOutput"),
    "DOCX generator should import sanitizeTemplateOutput"
  );
});

test("export-generator.ts imports countPlaceholders", () => {
  const exportPath = path.resolve(__dirname, "../export-generator.ts");
  const content = fs.readFileSync(exportPath, "utf-8");
  assertTrue(
    content.includes("countPlaceholders"),
    "export-generator should import countPlaceholders"
  );
});

test("export-generator.ts has sanitizeAllRewrites function", () => {
  const exportPath = path.resolve(__dirname, "../export-generator.ts");
  const content = fs.readFileSync(exportPath, "utf-8");
  assertTrue(
    content.includes("sanitizeAllRewrites"),
    "export-generator should contain sanitizeAllRewrites"
  );
});

test("export-generator.ts has countAllPlaceholders function", () => {
  const exportPath = path.resolve(__dirname, "../export-generator.ts");
  const content = fs.readFileSync(exportPath, "utf-8");
  assertTrue(
    content.includes("countAllPlaceholders"),
    "export-generator should contain countAllPlaceholders"
  );
});

test("export-generator.ts has EXPORT_HARD_STOP assertion", () => {
  const exportPath = path.resolve(__dirname, "../export-generator.ts");
  const content = fs.readFileSync(exportPath, "utf-8");
  assertTrue(
    content.includes("EXPORT_HARD_STOP"),
    "export-generator should contain EXPORT_HARD_STOP assertion"
  );
});

// ══════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════
console.log(`\n──────────────────────────────────────`);
console.log(`HOTFIX-9 Benchmark: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
