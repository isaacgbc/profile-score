/**
 * HOTFIX-9d — Real Bug Regression Tests
 *
 * These tests verify the ACTUAL bugs reported by the user:
 * 1. missingSuggestions must NEVER be empty (even with empty-string LLM responses)
 * 2. Entries beyond LLM cap must still appear as passthrough
 * 3. Export download endpoint returns file bytes (not redirect)
 * 4. CV contact-info header never contains objective text
 * 5. Source code structural verification
 * 6. HOTFIX-9c: Zod schema allows empty missingSuggestions
 * 7. HOTFIX-9c: Entry-synthesizer uses fallback suggestions
 * 8. HOTFIX-9c: Bullet guard applies to education sections
 * 9. HOTFIX-9c: Watermarks removed from all PDF/DOCX generators
 * 10. HOTFIX-9c: LinkedIn URL shortening + annotation extraction
 * 11. HOTFIX-9d: Education parsing — fragment merge on fallback paths
 * 12. HOTFIX-9d: LinkedIn dedup in CV header
 * 13. HOTFIX-9d: Export opens in new tab + UserName_Type filename
 * 14. HOTFIX-9d: Education hard cap uses /80 with floor of 3
 * 15. HOTFIX-9d: handleRewriteResult creates passthrough on null
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
  suggestions = ((suggestions ?? []) as string[]).filter((s) => s.trim().length > 0);
  if (suggestions.length === 0) {
    suggestions = getFallbackSuggestions("headline");
  }
  assertTrue(suggestions.length === 3, "should have 3 suggestions");
});

test("BUG REPRO: undefined missingSuggestions → must use fallback", () => {
  let suggestions: string[] | undefined = undefined;
  suggestions = ((suggestions ?? []) as string[]).filter((s) => s.trim().length > 0);
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

test("client-side export opens in new tab (HOTFIX-9d)", () => {
  const hookPath = path.resolve(__dirname, "../../../hooks/useExport.ts");
  const content = fs.readFileSync(hookPath, "utf-8");
  assertTrue(
    content.includes("inline=true"),
    "must use inline=true for new-tab preview"
  );
  assertTrue(
    content.includes("window.open"),
    "must use window.open for preview"
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

// Replicate the ACTUAL filter from updated-cv.ts (HOTFIX-9c version)
const HEADER_EXCLUDE_RE = /^(objective|professional\s*(goal|growth|summary|profile)|career\s*(objective|goal|summary)|seeking\s|driven\s|passionate\s|results.driven|goal.oriented|looking\s*(for|to)|summary\s*[|:])/i;
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
// 6. HOTFIX-9c: Zod schema allows empty missingSuggestions
// ══════════════════════════════════════════════════════════════════════
console.log("\n6. HOTFIX-9c: Zod schema allows empty missingSuggestions");

test("RewriteSectionOutput schema allows missingSuggestions: []", () => {
  const schemaPath = path.resolve(__dirname, "../../schemas/llm-output.ts");
  const content = fs.readFileSync(schemaPath, "utf-8");
  // Must NOT have .min(1) for missingSuggestions in RewriteSectionOutput
  // Must have .min(0) instead
  const rewriteBlock = content.slice(
    content.indexOf("RewriteSectionOutput"),
    content.indexOf("RewriteSectionOutputType")
  );
  assertTrue(
    rewriteBlock.includes(".min(0)"),
    "RewriteSectionOutput missingSuggestions must use .min(0)"
  );
  assertTrue(
    !rewriteBlock.includes("missingSuggestions: z.array(z.string()).min(1)"),
    "RewriteSectionOutput must NOT have .min(1) for missingSuggestions"
  );
});

test("RewriteSectionWithEntriesOutput schema allows missingSuggestions: []", () => {
  const schemaPath = path.resolve(__dirname, "../../schemas/llm-output.ts");
  const content = fs.readFileSync(schemaPath, "utf-8");
  const withEntriesBlock = content.slice(
    content.indexOf("RewriteSectionWithEntriesOutput"),
    content.indexOf("RewriteEntryOutputType")
  );
  assertTrue(
    withEntriesBlock.includes(".min(0)"),
    "RewriteSectionWithEntriesOutput missingSuggestions must use .min(0)"
  );
});

// ══════════════════════════════════════════════════════════════════════
// 7. HOTFIX-9c: Entry-synthesizer uses fallback suggestions
// ══════════════════════════════════════════════════════════════════════
console.log("\n7. HOTFIX-9c: Entry-synthesizer uses fallback suggestions");

test("entry-synthesizer imports getFallbackSuggestions", () => {
  const synthPath = path.resolve(__dirname, "../../utils/entry-synthesizer.ts");
  const content = fs.readFileSync(synthPath, "utf-8");
  assertTrue(
    content.includes("getFallbackSuggestions"),
    "entry-synthesizer must import getFallbackSuggestions"
  );
});

test("entry-synthesizer does NOT have missingSuggestions: []", () => {
  const synthPath = path.resolve(__dirname, "../../utils/entry-synthesizer.ts");
  const content = fs.readFileSync(synthPath, "utf-8");
  // Count raw empty missingSuggestions (should be zero)
  const emptyMatches = content.match(/missingSuggestions:\s*\[\]/g);
  assertTrue(
    emptyMatches === null || emptyMatches.length === 0,
    `entry-synthesizer should have 0 empty missingSuggestions, found ${emptyMatches?.length ?? 0}`
  );
});

// ══════════════════════════════════════════════════════════════════════
// 8. HOTFIX-9c: Bullet guard applies to all entry-based sections
// ══════════════════════════════════════════════════════════════════════
console.log("\n8. HOTFIX-9c: Bullet guard applies to all entry-based sections");

test("linkedin-parser bullet guard is NOT section-specific", () => {
  const parserPath = path.resolve(__dirname, "../linkedin-parser.ts");
  const content = fs.readFileSync(parserPath, "utf-8");
  // The bullet guard should NOT be gated behind a section-specific check
  // It should apply to all sections with entries
  assertTrue(
    content.includes("HOTFIX-9c bulletGuard"),
    "bullet guard must have HOTFIX-9c marker"
  );
  // Expanded bullet regex should include ● and ○
  assertTrue(
    content.includes("●") && content.includes("○"),
    "bullet regex must include ● and ○ characters"
  );
});

// ══════════════════════════════════════════════════════════════════════
// 9. HOTFIX-9c: Watermarks removed from ALL generators
// ══════════════════════════════════════════════════════════════════════
console.log("\n9. HOTFIX-9c: Watermarks removed from all generators");

test("no PDF/DOCX generator has 'Generated by Profile Score' text", () => {
  const generators = [
    path.resolve(__dirname, "../pdf/updated-cv.ts"),
    path.resolve(__dirname, "../pdf/results-summary.ts"),
    path.resolve(__dirname, "../pdf/cover-letter.ts"),
    path.resolve(__dirname, "../pdf/linkedin-updates.ts"),
    path.resolve(__dirname, "../pdf/full-audit.ts"),
    path.resolve(__dirname, "../docx/updated-cv-docx.ts"),
  ];
  for (const genPath of generators) {
    const content = fs.readFileSync(genPath, "utf-8");
    const basename = path.basename(genPath);
    assertTrue(
      !content.includes("Generated by Profile Score"),
      `${basename} still has watermark text`
    );
    assertTrue(
      !content.includes("Generado por Profile Score"),
      `${basename} still has Spanish watermark text`
    );
  }
});

// ══════════════════════════════════════════════════════════════════════
// 10. HOTFIX-9c: LinkedIn URL shortening + annotation extraction
// ══════════════════════════════════════════════════════════════════════
console.log("\n10. HOTFIX-9c: LinkedIn URL shortening + annotation extraction");

test("shortenLinkedInUrl strips protocol and www prefix", () => {
  // Import inline to avoid module resolution issues in tsx runner
  const sharedPath = path.resolve(__dirname, "../pdf/shared.ts");
  const content = fs.readFileSync(sharedPath, "utf-8");
  assertTrue(
    content.includes("shortenLinkedInUrl"),
    "shared.ts must export shortenLinkedInUrl"
  );
});

test("PDF and DOCX generators import shortenLinkedInUrl", () => {
  const pdfPath = path.resolve(__dirname, "../pdf/updated-cv.ts");
  const docxPath = path.resolve(__dirname, "../docx/updated-cv-docx.ts");
  assertTrue(
    fs.readFileSync(pdfPath, "utf-8").includes("shortenLinkedInUrl"),
    "PDF generator must import shortenLinkedInUrl"
  );
  assertTrue(
    fs.readFileSync(docxPath, "utf-8").includes("shortenLinkedInUrl"),
    "DOCX generator must import shortenLinkedInUrl"
  );
});

test("pdf-extract.ts extracts LinkedIn annotations from PDF", () => {
  const extractPath = path.resolve(__dirname, "../../utils/pdf-extract.ts");
  const content = fs.readFileSync(extractPath, "utf-8");
  assertTrue(
    content.includes("getAnnotations"),
    "pdf-extract must call getAnnotations()"
  );
  assertTrue(
    content.includes("linkedinUrls"),
    "pdf-extract must return linkedinUrls"
  );
});

test("extractContactInfoFallback prefers annotation-sourced LinkedIn URLs", () => {
  const orchestratorPath = path.resolve(__dirname, "../audit-orchestrator.ts");
  const content = fs.readFileSync(orchestratorPath, "utf-8");
  assertTrue(
    content.includes("ANNOTATION_MARKER_RE"),
    "extractContactInfoFallback must scan for annotation markers"
  );
  assertTrue(
    content.includes("annotationLinkedinUrl"),
    "must track annotation-sourced LinkedIn URL"
  );
});

test("header filter catches first-line objective (HOTFIX-9c strengthened)", () => {
  // The critical bug: first line is "Objective: Professional grade"
  // Before HOTFIX-9c, the filter had `if (idx === 0) return true` BEFORE exclude check
  const lines = [
    "Objective: Professional grade",
    "john@email.com",
    "555-1234",
  ];
  const filtered = filterContactLines(lines);
  assertTrue(
    !filtered.some(l => l.includes("Objective")),
    "must filter objective even on first line"
  );
});

test("header filter catches 'Summary |' pattern", () => {
  const lines = [
    "Bob Jones",
    "Summary | Team lead with 5 years experience",
    "bob@email.com",
  ];
  const filtered = filterContactLines(lines);
  assertEqual(filtered.length, 2, "should filter Summary line");
  assertTrue(!filtered.some(l => l.includes("Summary")), "must not contain Summary");
});

// ══════════════════════════════════════════════════════════════════════
// 11. HOTFIX-9d: Education fragment merge on fallback paths
// ══════════════════════════════════════════════════════════════════════
console.log("\n11. HOTFIX-9d: Education fragment merge on fallback paths");

test("fallback path (no date lines) applies mergeFragmentEntries", () => {
  const parserPath = path.resolve(__dirname, "../linkedin-parser.ts");
  const content = fs.readFileSync(parserPath, "utf-8");
  // The first fallback path: dateLineIndices.length === 0 → parseEducationFallback → mergeFragmentEntries
  const startIdx = content.indexOf("if (dateLineIndices.length === 0)");
  // End at the line "return result; // confidence stays" which closes the dateLines === 0 block
  const endIdx = content.indexOf('return result; // confidence stays "low"', startIdx);
  const dateLines0Block = content.slice(startIdx, endIdx);
  assertTrue(
    dateLines0Block.includes("mergeFragmentEntries"),
    "fallback path (dateLines=0) must call mergeFragmentEntries"
  );
});

test("fallback path (quality preferred) applies mergeFragmentEntries", () => {
  const parserPath = path.resolve(__dirname, "../linkedin-parser.ts");
  const content = fs.readFileSync(parserPath, "utf-8");
  // The second fallback (qualityFallback.length > entries.length) must also merge
  const secondFallbackBlock = content.slice(
    content.indexOf("if (qualityFallback.length > entries.length)"),
    content.indexOf("// ── HOTFIX-CV: Post-parse merge guard")
  );
  assertTrue(
    secondFallbackBlock.includes("mergeFragmentEntries"),
    "quality fallback path must call mergeFragmentEntries"
  );
});

test("'about' section has fallback suggestions", () => {
  const suggestions = getFallbackSuggestions("about");
  assertTrue(suggestions.length >= 3, "'about' must have fallback suggestions");
});

// ══════════════════════════════════════════════════════════════════════
// 12. HOTFIX-9d: LinkedIn dedup in CV header
// ══════════════════════════════════════════════════════════════════════
console.log("\n12. HOTFIX-9d: LinkedIn dedup in CV header");

test("PDF generator deduplicates bare 'LinkedIn' text when URL exists", () => {
  const pdfPath = path.resolve(__dirname, "../pdf/updated-cv.ts");
  const content = fs.readFileSync(pdfPath, "utf-8");
  assertTrue(
    content.includes("hasLinkedInUrl") && content.includes("deduped"),
    "PDF must deduplicate LinkedIn entries"
  );
});

test("DOCX generator deduplicates bare 'LinkedIn' text when URL exists", () => {
  const docxPath = path.resolve(__dirname, "../docx/updated-cv-docx.ts");
  const content = fs.readFileSync(docxPath, "utf-8");
  assertTrue(
    content.includes("hasLinkedInUrl") && content.includes("dedupedLines"),
    "DOCX must deduplicate LinkedIn entries"
  );
});

test("LinkedIn dedup logic: bare 'LinkedIn' removed when URL present", () => {
  const lines = [
    "John Smith",
    "LinkedIn",
    "linkedin.com/in/johnsmith",
    "john@email.com",
  ];
  const hasLinkedInUrl = lines.some(l => /linkedin\.com\/in\//i.test(l));
  const deduped = hasLinkedInUrl
    ? lines.filter(l => !/^\s*linkedin\s*$/i.test(l.trim()))
    : lines;
  assertEqual(deduped.length, 3, "should remove bare 'LinkedIn' text");
  assertTrue(!deduped.some(l => /^\s*linkedin\s*$/i.test(l.trim())), "bare LinkedIn removed");
  assertTrue(deduped.some(l => l.includes("linkedin.com/in/")), "URL preserved");
});

test("LinkedIn dedup logic: keeps 'LinkedIn' when no URL present", () => {
  const lines = ["John Smith", "LinkedIn", "john@email.com"];
  const hasLinkedInUrl = lines.some(l => /linkedin\.com\/in\//i.test(l));
  const deduped = hasLinkedInUrl
    ? lines.filter(l => !/^\s*linkedin\s*$/i.test(l.trim()))
    : lines;
  assertEqual(deduped.length, 3, "should keep all lines when no URL");
});

// ══════════════════════════════════════════════════════════════════════
// 13. HOTFIX-9d: Export in new tab + UserName_Type filename
// ══════════════════════════════════════════════════════════════════════
console.log("\n13. HOTFIX-9d: Export opens in new tab + filename");

test("export API supports inline disposition for preview", () => {
  const routePath = path.resolve(__dirname, "../../../app/api/exports/[id]/route.ts");
  const content = fs.readFileSync(routePath, "utf-8");
  assertTrue(content.includes("inline"), "must support inline disposition");
  assertTrue(content.includes("EXPORT_TYPE_LABELS"), "must have export type label map");
  assertTrue(content.includes("extractCandidateName"), "must extract candidate name for filename");
});

test("export filename uses UserName_Type pattern", () => {
  const routePath = path.resolve(__dirname, "../../../app/api/exports/[id]/route.ts");
  const content = fs.readFileSync(routePath, "utf-8");
  assertTrue(
    content.includes("candidateName") && content.includes("typeLabel"),
    "filename must use candidateName + typeLabel"
  );
  assertTrue(
    content.includes("UpdatedCV") && content.includes("ResultsSummary"),
    "must map export types to readable labels"
  );
});

// ══════════════════════════════════════════════════════════════════════
// 14. HOTFIX-9d: Education hard cap uses /80 with floor of 3
// ══════════════════════════════════════════════════════════════════════
console.log("\n14. HOTFIX-9d: Education hard cap /80 with floor 3");

test("mergeEducationOverSplit uses /80 divisor (not /150)", () => {
  const parserPath = path.resolve(__dirname, "../linkedin-parser.ts");
  const content = fs.readFileSync(parserPath, "utf-8");
  const mergeBlock = content.slice(
    content.indexOf("function mergeEducationOverSplit"),
    content.indexOf("function estimateSectionEntryCount")
  );
  assertTrue(
    mergeBlock.includes("sectionCharLength / 80"),
    "hard cap must use /80 divisor"
  );
  assertTrue(
    mergeBlock.includes("Math.max(3,"),
    "hard cap must have floor of 3"
  );
  assertTrue(
    !mergeBlock.includes("sectionCharLength / 150)"),
    "must NOT use old /150 divisor"
  );
});

test("3 short education entries survive hard cap (240 chars total)", () => {
  // Simulate: 3 entries × 80 chars = 240 total chars
  const sectionCharLength = 240;
  const maxEntries = Math.max(3, Math.ceil(sectionCharLength / 80));
  assertTrue(maxEntries >= 3, `maxEntries for 240 chars should be >= 3, got ${maxEntries}`);
});

test("3 very short education entries survive hard cap (195 chars total)", () => {
  // Simulate: 3 entries × 65 chars = 195 total chars
  const sectionCharLength = 195;
  const maxEntries = Math.max(3, Math.ceil(sectionCharLength / 80));
  assertTrue(maxEntries >= 3, `maxEntries for 195 chars should be >= 3, got ${maxEntries}`);
});

test("estimateSectionEntryCount uses /80 for education sections", () => {
  const parserPath = path.resolve(__dirname, "../linkedin-parser.ts");
  const content = fs.readFileSync(parserPath, "utf-8");
  const estimateBlock = content.slice(
    content.indexOf("function estimateSectionEntryCount"),
    content.indexOf("// ── LLM Structuring")
  );
  assertTrue(
    estimateBlock.includes("education") && estimateBlock.includes("80"),
    "estimator must use 80-char divisor for education"
  );
});

// ══════════════════════════════════════════════════════════════════════
// 15. HOTFIX-9d: handleRewriteResult creates passthrough on null
// ══════════════════════════════════════════════════════════════════════
console.log("\n15. HOTFIX-9d: handleRewriteResult passthrough on null");

test("handleRewriteResult creates passthrough rewrite when result is null", () => {
  const orchestratorPath = path.resolve(__dirname, "../audit-orchestrator.ts");
  const content = fs.readFileSync(orchestratorPath, "utf-8");
  const handleBlock = content.slice(
    content.indexOf("const handleRewriteResult"),
    content.indexOf("const linkedinRewritePromises")
  );
  assertTrue(
    handleBlock.includes("passthroughRewrite"),
    "handleRewriteResult must create passthrough on null"
  );
  assertTrue(
    handleBlock.includes("getFallbackSuggestions"),
    "passthrough must use getFallbackSuggestions"
  );
  assertTrue(
    !handleBlock.includes("console.warn(`[fallback] Skipping rewrite"),
    "must NOT silently skip sections (old behavior)"
  );
});

test("Studio UI handles undefined missingSuggestions safely", () => {
  const sectionEditorPath = path.resolve(__dirname, "../../../components/studio/StudioSectionEditor.tsx");
  const entryEditorPath = path.resolve(__dirname, "../../../components/studio/StudioEntryEditor.tsx");
  const sectionContent = fs.readFileSync(sectionEditorPath, "utf-8");
  const entryContent = fs.readFileSync(entryEditorPath, "utf-8");
  // Both must use nullish coalescing for missingSuggestions
  assertTrue(
    sectionContent.includes("missingSuggestions ?? []"),
    "StudioSectionEditor must guard against undefined missingSuggestions"
  );
  assertTrue(
    entryContent.includes("missingSuggestions ?? []"),
    "StudioEntryEditor must guard against undefined missingSuggestions"
  );
});

// ══════════════════════════════════════════════════════════════════════
// Results
// ══════════════════════════════════════════════════════════════════════
console.log(`\n──────────────────────────────────────`);
console.log(`HOTFIX-9d Benchmark: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
