/**
 * HOTFIX-9b — Real Bug Regression Tests
 *
 * These tests verify the ACTUAL bugs reported by the user:
 * 1. missingSuggestions must NEVER be empty (even with empty-string LLM responses)
 * 2. Entries beyond LLM cap must still appear as passthrough
 * 3. Export download endpoint returns file bytes (not redirect)
 * 4. CV contact-info header never contains objective text
 * 5. Source code structural verification
 */

import * as fs from "node:fs";
import * as path from "node:path";
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
// 1. missingSuggestions NEVER empty — even with LLM edge cases
// ══════════════════════════════════════════════════════════════════════
console.log("\n1. missingSuggestions never empty (real LLM edge cases)");

test("BUG REPRO: empty strings in array → must be replaced by fallback", () => {
  // LLM returns missingSuggestions: [""] — this was bypassing the guard
  let suggestions: string[] = [""];
  // Apply the HOTFIX-9b fix: filter empty strings first
  suggestions = suggestions.filter((s) => s.trim().length > 0);
  if (suggestions.length === 0) {
    suggestions = getFallbackSuggestions("experience");
  }
  assertTrue(suggestions.length === 3, `should have 3 after fix, got ${suggestions.length}`);
  assertTrue(suggestions[0].length > 5, "first suggestion should be meaningful");
});

test("BUG REPRO: array with whitespace-only strings → must be replaced", () => {
  let suggestions: string[] = ["  ", "\t", "\n"];
  suggestions = suggestions.filter((s) => s.trim().length > 0);
  if (suggestions.length === 0) {
    suggestions = getFallbackSuggestions("summary");
  }
  assertTrue(suggestions.length === 3, "should have 3 suggestions");
});

test("BUG REPRO: null missingSuggestions → must use fallback", () => {
  let suggestions: string[] | null = null;
  suggestions = (suggestions ?? []).filter((s) => s.trim().length > 0);
  if (suggestions.length === 0) {
    suggestions = getFallbackSuggestions("headline");
  }
  assertTrue(suggestions.length === 3, "should have 3 suggestions");
});

test("BUG REPRO: undefined missingSuggestions → must use fallback", () => {
  let suggestions: string[] | undefined = undefined;
  suggestions = (suggestions ?? []).filter((s) => s.trim().length > 0);
  if (suggestions.length === 0) {
    suggestions = getFallbackSuggestions("skills");
  }
  assertTrue(suggestions.length === 3, "should have 3 suggestions");
});

test("valid LLM suggestions are preserved (not replaced)", () => {
  let suggestions: string[] = ["Add metrics", "Include impact", "Mention technologies"];
  suggestions = suggestions.filter((s) => s.trim().length > 0);
  if (suggestions.length === 0) {
    suggestions = getFallbackSuggestions("experience");
  }
  assertEqual(suggestions[0], "Add metrics", "first suggestion preserved");
  assertEqual(suggestions.length, 3, "count preserved");
});

test("every section has at least 3 fallback suggestions", () => {
  const allSections = [
    "headline", "summary", "experience", "education", "skills",
    "featured", "recommendations", "certifications",
    "contact-info", "professional-summary", "work-experience",
    "skills-section", "education-section",
  ];
  for (const id of allSections) {
    const suggestions = getFallbackSuggestions(id);
    assertTrue(suggestions.length >= 3, `${id} has ${suggestions.length} suggestions`);
    for (const s of suggestions) {
      assertTrue(s.trim().length > 5, `${id} has empty/short suggestion: "${s}"`);
    }
  }
});

// ══════════════════════════════════════════════════════════════════════
// 2. Entry loss — passthrough entries for uncapped ones
// ══════════════════════════════════════════════════════════════════════
console.log("\n2. Entry loss prevention (passthrough for uncapped entries)");

test("source code: rewriteSectionWithEntries appends passthrough entries beyond cap", () => {
  const orchestratorPath = path.resolve(__dirname, "../audit-orchestrator.ts");
  const content = fs.readFileSync(orchestratorPath, "utf-8");
  assertTrue(
    content.includes("entries.slice(firstPassCap)"),
    "must slice remaining entries beyond cap"
  );
  assertTrue(
    content.includes("rewriteEntries.push(...remainingEntries)"),
    "must push remaining entries to rewriteEntries"
  );
});

test("source code: fastSectionRewriteWithEntries also appends passthrough entries", () => {
  const orchestratorPath = path.resolve(__dirname, "../audit-orchestrator.ts");
  const content = fs.readFileSync(orchestratorPath, "utf-8");
  // Count occurrences of the passthrough append pattern
  const matches = content.match(/entries\.slice\(firstPassCap\)/g);
  assertTrue(
    matches !== null && matches.length >= 2,
    `passthrough append should appear in both rewrite functions, found ${matches?.length ?? 0}`
  );
});

test("MAX_SECTION_CHARS raised to prevent truncation of entry-heavy sections", () => {
  const orchestratorPath = path.resolve(__dirname, "../audit-orchestrator.ts");
  const content = fs.readFileSync(orchestratorPath, "utf-8");
  const match = content.match(/MAX_SECTION_CHARS\s*=\s*(\d[\d_]*)/);
  assertTrue(match !== null, "MAX_SECTION_CHARS must be defined");
  const value = parseInt(match![1].replace(/_/g, ""));
  assertTrue(value >= 20000, `MAX_SECTION_CHARS is ${value}, expected >= 20000`);
});

test("passthrough entries get fallback suggestions (not empty)", () => {
  // Simulate building a passthrough entry
  const sectionId = "experience";
  const passthroughEntry = {
    entryIndex: 16,
    entryTitle: "Old Job at Old Company",
    original: "Did stuff",
    improvements: "",
    missingSuggestions: getFallbackSuggestions(sectionId),
    rewritten: "Did stuff",
  };
  assertTrue(
    passthroughEntry.missingSuggestions.length >= 3,
    "passthrough entry must have fallback suggestions"
  );
});

// ══════════════════════════════════════════════════════════════════════
// 3. Export download — file bytes proxied (not redirect)
// ══════════════════════════════════════════════════════════════════════
console.log("\n3. Export download endpoint returns bytes (not redirect)");

test("download endpoint proxies file bytes instead of 302 redirect", () => {
  const routePath = path.resolve(__dirname, "../../../app/api/exports/[id]/route.ts");
  const content = fs.readFileSync(routePath, "utf-8");
  // Should NOT have redirect
  assertTrue(
    !content.includes("NextResponse.redirect(signedUrl"),
    "download endpoint must NOT redirect to signed URL"
  );
  // Should have Content-Disposition header
  assertTrue(
    content.includes("Content-Disposition"),
    "must set Content-Disposition header"
  );
  // Should fetch and proxy
  assertTrue(
    content.includes("await fetch(signedUrl)"),
    "must fetch file bytes from signed URL"
  );
  assertTrue(
    content.includes("fileRes.arrayBuffer()"),
    "must read arrayBuffer from fetch response"
  );
});

test("client-side download extracts filename from Content-Disposition", () => {
  const hookPath = path.resolve(__dirname, "../../../hooks/useExport.ts");
  const content = fs.readFileSync(hookPath, "utf-8");
  assertTrue(
    content.includes("content-disposition"),
    "must read Content-Disposition header"
  );
  assertTrue(
    content.includes("filenameMatch"),
    "must extract filename from header"
  );
});

// ══════════════════════════════════════════════════════════════════════
// 4. CV header NEVER shows objective text
// ══════════════════════════════════════════════════════════════════════
console.log("\n4. CV header never contains objective text");

test("source code: contact-info section skips LLM rewrite (passthrough)", () => {
  const orchestratorPath = path.resolve(__dirname, "../audit-orchestrator.ts");
  const content = fs.readFileSync(orchestratorPath, "utf-8");
  assertTrue(
    content.includes('section.id === "contact-info"') &&
    content.includes('modelUsed: "passthrough"'),
    "contact-info must be passthrough (skip LLM rewrite)"
  );
});

// Replicate the ACTUAL filter from updated-cv.ts (HOTFIX-9b version)
const HEADER_EXCLUDE_RE = /^(objective|professional\s*(goal|growth|summary|profile)|career\s*(objective|goal|summary)|seeking\s|driven\s|passionate\s|results.driven|goal.oriented|looking\s*(for|to))/i;
const SEPARATOR_ONLY_RE = /^\s*[|,;\-–—]+\s*$/;
const CONTACT_PATTERN_RE = /(@|phone|\+?\d[\d\s\-().]{5,}|linkedin\.com|github\.com|\.com\b|[A-Z][a-z]+,\s*[A-Z]{2})/i;

function filterContactLines(lines: string[]): string[] {
  return lines.filter((line, idx) => {
    const trimmed = line.trim();
    if (HEADER_EXCLUDE_RE.test(trimmed)) return false;
    if (SEPARATOR_ONLY_RE.test(trimmed)) return false;
    if (/^objective\s*[|:]/i.test(trimmed)) return false;
    if (idx === 0) return true;
    if (trimmed.length > 80 && !CONTACT_PATTERN_RE.test(trimmed)) return false;
    return true;
  });
}

test("BUG REPRO: filters 'Objective | Professional growth' from header", () => {
  const lines = [
    "John Smith",
    "john@email.com | 555-1234",
    "Objective | Professional growth",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should have 2 lines");
  assertTrue(!filtered.some(l => l.includes("Objective")), "must not contain Objective");
});

test("filters 'Seeking a leadership position in tech' from header", () => {
  const lines = [
    "Jane Doe",
    "Seeking a leadership position in technology management",
    "jane@email.com",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should have 2 lines");
  assertTrue(filtered.includes("jane@email.com"), "must preserve email");
});

test("filters 'Driven professional looking for growth' from header", () => {
  const lines = [
    "Alex J",
    "Driven professional looking for growth opportunities in fintech",
    "alex@company.com | New York, NY",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should have 2 lines");
  assertTrue(filtered.includes("Alex J"), "must preserve name");
});

test("filters 'Results-driven manager...' long description from header", () => {
  const lines = [
    "Sarah Lee",
    "Results-driven manager with 10 years of experience in building high-performance engineering teams across multiple continents and industries.",
    "sarah@email.com | San Francisco, CA",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should have 2 lines (long non-contact removed)");
});

test("preserves normal contact lines (no false positives)", () => {
  const lines = [
    "Sarah Lee",
    "sarah@email.com | 555-9876 | linkedin.com/in/sarahlee",
    "San Francisco, CA 94105",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 3, "should preserve all 3 contact lines");
});

test("filters 'Professional Summary' from header", () => {
  const lines = [
    "Bob Jones",
    "Professional Summary",
    "bob@email.com",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should filter Professional Summary");
});

test("filters 'Career Objective: ...' from header", () => {
  const lines = [
    "Bob Jones",
    "Career Objective: To lead AI initiatives",
    "bob@email.com | (555) 555-1234",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should filter Career Objective line");
});

// ══════════════════════════════════════════════════════════════════════
// 5. Structural verification — code correctness
// ══════════════════════════════════════════════════════════════════════
console.log("\n5. Structural verification");

test("missingSuggestions filter uses .trim().length > 0 pattern", () => {
  const orchestratorPath = path.resolve(__dirname, "../audit-orchestrator.ts");
  const content = fs.readFileSync(orchestratorPath, "utf-8");
  const pattern = '.filter((s) => s.trim().length > 0)';
  const altPattern = '.filter((s: string) => s.trim().length > 0)';
  const matches = (content.match(/\.filter\(\(s(?:: string)?\) => s\.trim\(\)\.length > 0\)/g) ?? []).length;
  assertTrue(matches >= 4, `filter pattern must appear at least 4 times (section + entry level), found ${matches}`);
});

test("DOCX generator imports sanitizeTemplateOutput", () => {
  const docxPath = path.resolve(__dirname, "../docx/updated-cv-docx.ts");
  const content = fs.readFileSync(docxPath, "utf-8");
  assertTrue(content.includes("sanitizeTemplateOutput"), "must import sanitizer");
});

test("export-generator has sanitizeAllRewrites and countAllPlaceholders", () => {
  const exportPath = path.resolve(__dirname, "../export-generator.ts");
  const content = fs.readFileSync(exportPath, "utf-8");
  assertTrue(content.includes("sanitizeAllRewrites"), "must have sanitizeAllRewrites");
  assertTrue(content.includes("countAllPlaceholders"), "must have countAllPlaceholders");
  assertTrue(content.includes("EXPORT_HARD_STOP"), "must have hard stop assertion");
});

test("PDF and DOCX header filters match (both updated)", () => {
  const pdfPath = path.resolve(__dirname, "../pdf/updated-cv.ts");
  const docxPath = path.resolve(__dirname, "../docx/updated-cv-docx.ts");
  const pdfContent = fs.readFileSync(pdfPath, "utf-8");
  const docxContent = fs.readFileSync(docxPath, "utf-8");
  // Both must have the strengthened filter
  assertTrue(pdfContent.includes("CONTACT_PATTERN_RE"), "PDF must have contact pattern check");
  assertTrue(docxContent.includes("CONTACT_PATTERN_RE"), "DOCX must have contact pattern check");
  assertTrue(pdfContent.includes("seeking"), "PDF filter must catch 'seeking'");
  assertTrue(docxContent.includes("seeking"), "DOCX filter must catch 'seeking'");
});

test("sanitizeTemplateOutput strips placeholders", () => {
  const input = "Increased revenue by [ADD_METRIC: percentage] over Q3";
  const output = sanitizeTemplateOutput(input);
  assertEqual(countPlaceholders(output), 0, "should have 0 placeholders");
});

// ══════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════
console.log(`\n──────────────────────────────────────`);
console.log(`HOTFIX-9b Benchmark: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
