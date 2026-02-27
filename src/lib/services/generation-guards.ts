/**
 * Generation Hardening Guards
 *
 * Validates that LLM outputs are genuinely input-dependent, not static/placeholder.
 * Used by audit-orchestrator.ts to reject canned outputs and enforce quality.
 *
 * Guards:
 * 1. Placeholder signature detection (rejects known mock patterns)
 * 2. Input-overlap validation (ensures outputs reference user content)
 * 3. Section completeness validation (ensures proper section count)
 * 4. Rewrite fidelity check (ensures rewrites transform user text)
 */

import type { ScoreSection, RewritePreview, ProfileResult } from "@/lib/types";
import { mockResults } from "@/lib/mock/results";

// ── 1. Placeholder Signature Detection ─────────────────

/**
 * Known placeholder/mock phrases from results.ts that MUST NOT appear
 * in real LLM output. If an output matches these, it's a mock leak.
 */
const MOCK_FINGERPRINTS = [
  // Mock headline rewrite signatures
  "Senior Full-Stack Engineer | Building scalable SaaS products",
  // Mock summary rewrite signatures
  "Full-stack engineer with 5+ years turning complex business requirements",
  // Mock experience rewrite signatures
  "Led development of customer-facing dashboard serving 50K daily active users",
  // Mock CV summary
  "Senior Full-Stack Engineer with 5+ years of experience building scalable web applications using React, Node.js, and AWS",
  // Mock cover letter
  "I am writing to express my strong interest in the Senior Full-Stack Engineer position",
  // Mock explanation fingerprints
  "Your headline includes a job title but lacks keywords recruiters search for, a value proposition",
  "Your summary is vague with no metrics, no specialization",
  "Your experience section lists responsibilities but lacks specific achievements",
  "Your skills list is flat with no hierarchy",
  "No certifications listed. Industry certifications significantly boost ATS ranking",
  "You have no recommendations. Profiles with 3+ recommendations",
  // Mock CV explanations
  "Contact information is present but could include a portfolio link",
  "Your CV summary is generic and could be for anyone",
  "Work experience has good structure but bullets lack quantified impact",
  "Skills section needs better categorization. ATS systems match exact keywords",
];

/**
 * Check if text matches any known mock/placeholder fingerprint.
 * Uses substring matching with a minimum overlap threshold.
 */
export function isPlaceholderContent(text: string): boolean {
  if (!text || text.length < 20) return false;
  const lower = text.toLowerCase();

  for (const fingerprint of MOCK_FINGERPRINTS) {
    if (lower.includes(fingerprint.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a scored section looks like mock data.
 * Compares explanation + suggestions against known mock patterns.
 */
export function isMockSection(section: ScoreSection): boolean {
  // Check explanation
  if (isPlaceholderContent(section.explanation)) return true;

  // Check if score matches mock exactly for this section
  const mockSection =
    mockResults.linkedinSections.find((s) => s.id === section.id) ??
    mockResults.cvSections.find((s) => s.id === section.id);

  if (mockSection) {
    // If explanation is identical to mock, it's a mock leak
    if (section.explanation === mockSection.explanation) return true;
    // If score AND explanation first 50 chars match, likely mock
    if (
      section.score === mockSection.score &&
      section.explanation.slice(0, 50) ===
        mockSection.explanation.slice(0, 50)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a rewrite looks like mock data.
 */
export function isMockRewrite(rewrite: RewritePreview): boolean {
  if (isPlaceholderContent(rewrite.rewritten)) return true;
  if (isPlaceholderContent(rewrite.improvements)) return true;

  const mockRewrite =
    mockResults.linkedinRewrites.find(
      (r) => r.sectionId === rewrite.sectionId
    ) ??
    mockResults.cvRewrites.find((r) => r.sectionId === rewrite.sectionId);

  if (mockRewrite) {
    if (rewrite.rewritten === mockRewrite.rewritten) return true;
    if (rewrite.improvements === mockRewrite.improvements) return true;
  }

  return false;
}

// ── 2. Input-Overlap Validation ────────────────────────

/**
 * Extract significant words (3+ chars, lowercased) from text.
 * Filters out common stop words.
 */
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has",
  "been", "are", "was", "were", "will", "can", "not", "but", "your",
  "you", "they", "their", "them", "our", "its", "than", "more",
  "also", "very", "just", "about", "into", "over", "such", "some",
  "other", "which", "when", "what", "where", "who", "how", "all",
  "each", "should", "would", "could", "may", "might", "must",
  "using", "used", "use", "include", "including", "includes",
]);

function extractSignificantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  );
}

/**
 * Compute overlap ratio: how many significant words from the output
 * appear in the source input. Returns 0-1.
 */
export function computeInputOverlap(
  sourceInput: string,
  llmOutput: string
): number {
  const sourceWords = extractSignificantWords(sourceInput);
  const outputWords = extractSignificantWords(llmOutput);

  if (outputWords.size === 0) return 0;

  let overlap = 0;
  for (const word of outputWords) {
    if (sourceWords.has(word)) overlap++;
  }

  return overlap / outputWords.size;
}

/**
 * Validates that an audit explanation references the user's actual content.
 * An explanation with 0% overlap to the source is suspicious (generic/canned).
 *
 * Returns true if the explanation passes the overlap check.
 *
 * For missing sections (where content starts with "[This section was not found"),
 * we relax the check since the LLM is generating guidance, not referencing content.
 */
export function validateExplanationRelevance(
  sectionContent: string,
  explanation: string,
  _sectionId: string
): boolean {
  // Missing sections get a pass — LLM provides guidance, not content reference
  if (sectionContent.startsWith("[This section was not found")) return true;

  // For present sections, require at least some keyword overlap
  const overlap = computeInputOverlap(sectionContent, explanation);

  // Threshold: at least 5% of significant words in explanation should
  // come from the source content. Very low bar, but catches completely
  // generic explanations.
  return overlap >= 0.05;
}

/**
 * Validates that a rewrite transforms the user's actual text.
 * The rewritten content should share significant words with the source
 * (proving it's based on the user's content, not generic).
 */
export function validateRewriteRelevance(
  sourceContent: string,
  rewrite: RewritePreview
): boolean {
  // Missing sections: check that improvements mention the section context
  if (sourceContent.startsWith("[This section was not found")) {
    // For missing sections, the rewrite should have missingSuggestions
    return rewrite.missingSuggestions.length > 0;
  }

  // For present sections: rewritten text should have some overlap with source
  const overlap = computeInputOverlap(sourceContent, rewrite.rewritten);
  return overlap >= 0.03; // Very low threshold — just proves it's not random
}

// ── 3. Section Completeness Validation ─────────────────

/**
 * Validate that the expected number of sections were generated.
 * If significantly fewer sections than expected, signals a parser failure.
 */
export function validateSectionCompleteness(
  hasLinkedinInput: boolean,
  hasCvInput: boolean,
  linkedinSections: ScoreSection[],
  cvSections: ScoreSection[],
  expectedLinkedinIds: readonly string[],
  expectedCvIds: readonly string[]
): {
  valid: boolean;
  linkedinMissing: string[];
  cvMissing: string[];
  autoRetrigger: boolean;
} {
  const linkedinMissing: string[] = [];
  const cvMissing: string[] = [];

  if (hasLinkedinInput) {
    const generatedLinkedinIds = new Set(linkedinSections.map((s) => s.id));
    for (const id of expectedLinkedinIds) {
      if (!generatedLinkedinIds.has(id)) linkedinMissing.push(id);
    }
  }

  if (hasCvInput) {
    const generatedCvIds = new Set(cvSections.map((s) => s.id));
    for (const id of expectedCvIds) {
      if (!generatedCvIds.has(id)) cvMissing.push(id);
    }
  }

  const totalExpected =
    (hasLinkedinInput ? expectedLinkedinIds.length : 0) +
    (hasCvInput ? expectedCvIds.length : 0);
  const totalGenerated = linkedinSections.length + cvSections.length;

  // Auto-retrigger if less than 50% of expected sections generated
  const autoRetrigger =
    totalExpected > 0 && totalGenerated < totalExpected * 0.5;

  return {
    valid: linkedinMissing.length === 0 && cvMissing.length === 0,
    linkedinMissing,
    cvMissing,
    autoRetrigger,
  };
}

// ── 4. Emoji Sanitizer ─────────────────────────────────

/**
 * Strip all emojis from text EXCEPT country flag sequences (Regional Indicator pairs).
 * Country flags are U+1F1E6–U+1F1FF paired together.
 *
 * Approach: save flag sequences → strip all emoji → restore flags.
 */
export function stripNonFlagEmojis(text: string): string {
  if (!text) return text;

  // Match country flag sequences (two Regional Indicator Symbol Letters)
  const FLAG_RE = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;

  // Save flag sequences with their positions
  const flags: { flag: string; placeholder: string }[] = [];
  let flagIndex = 0;
  const textWithPlaceholders = text.replace(FLAG_RE, (match) => {
    const placeholder = `__FLAG_${flagIndex}__`;
    flags.push({ flag: match, placeholder });
    flagIndex++;
    return placeholder;
  });

  // Strip all remaining emoji using a broad Unicode emoji pattern
  // Covers: emoticons, dingbats, symbols, pictographs, transport, supplemental, etc.
  const EMOJI_RE =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{FE0F}\u{E0020}-\u{E007F}\u{2300}-\u{23FF}\u{2B05}-\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{231A}\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}\u{26AB}\u{26BD}\u{26BE}\u{26C4}\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}]/gu;
  const stripped = textWithPlaceholders.replace(EMOJI_RE, "");

  // Clean up any double spaces left by emoji removal
  let result = stripped.replace(/  +/g, " ").trim();

  // Restore flag sequences
  for (const { flag, placeholder } of flags) {
    result = result.replace(placeholder, flag);
  }

  return result;
}

// ── 5. Anti-Duplication Guard ──────────────────────────

/**
 * Check if the overall descriptor is too similar to the headline explanation.
 * Returns true if >60% significant word overlap detected.
 */
export function isOverallDescriptorDuplicate(
  descriptor: string,
  headlineExplanation: string
): boolean {
  if (!descriptor || !headlineExplanation) return false;
  const overlap = computeInputOverlap(headlineExplanation, descriptor);
  return overlap > 0.6;
}

// ── 6. Full Result Validation ──────────────────────────

export interface ValidationReport {
  valid: boolean;
  mockLeaks: string[]; // section IDs where mock data leaked
  genericOutputs: string[]; // section IDs with no input overlap
  mockRewriteLeaks: string[]; // rewrite section IDs with mock data
  sectionCountValid: boolean;
  totalIssues: number;
}

/**
 * Comprehensive validation of a generation result.
 * Used after assembly to detect any quality issues.
 */
export function validateGenerationResult(
  result: ProfileResult,
  sourceLinkedinSections: Record<string, string>,
  sourceCvSections: Record<string, string>,
  hasLinkedinInput: boolean,
  hasCvInput: boolean,
  expectedLinkedinIds: readonly string[],
  expectedCvIds: readonly string[]
): ValidationReport {
  const mockLeaks: string[] = [];
  const genericOutputs: string[] = [];
  const mockRewriteLeaks: string[] = [];

  // Check scored sections for mock leaks and generic outputs
  for (const section of [
    ...result.linkedinSections,
    ...result.cvSections,
  ]) {
    if (isMockSection(section)) {
      mockLeaks.push(section.id);
    }

    // Check explanation relevance against source content
    const sourceContent =
      sourceLinkedinSections[section.id] ??
      sourceCvSections[section.id] ??
      "";

    if (
      sourceContent &&
      !sourceContent.startsWith("[This section was not found") &&
      !validateExplanationRelevance(sourceContent, section.explanation, section.id)
    ) {
      genericOutputs.push(section.id);
    }
  }

  // Check rewrites for mock leaks
  for (const rewrite of [
    ...result.linkedinRewrites,
    ...result.cvRewrites,
  ]) {
    if (isMockRewrite(rewrite)) {
      mockRewriteLeaks.push(rewrite.sectionId);
    }
  }

  // Check section completeness
  const completeness = validateSectionCompleteness(
    hasLinkedinInput,
    hasCvInput,
    result.linkedinSections,
    result.cvSections,
    expectedLinkedinIds,
    expectedCvIds
  );

  const totalIssues =
    mockLeaks.length + genericOutputs.length + mockRewriteLeaks.length;

  return {
    valid: totalIssues === 0 && completeness.valid,
    mockLeaks,
    genericOutputs,
    mockRewriteLeaks,
    sectionCountValid: completeness.valid,
    totalIssues,
  };
}

// ── 7. Repetitive Entry Content Detection ────────────
// v2 quality guard: detect when LLM rewrites are too similar across entries

export interface RepetitiveContentResult {
  repetitive: boolean;
  duplicatePairs: number;
  totalPairs: number;
  worstOverlap: number;
}

/**
 * Check if entry rewrites are suspiciously repetitive.
 * Returns detailed result with overlap metrics.
 *
 * Logging-only diagnostic — does not block generation.
 */
export function hasRepetitiveEntryContent(entryTexts: string[]): RepetitiveContentResult {
  if (entryTexts.length < 2) {
    return { repetitive: false, duplicatePairs: 0, totalPairs: 0, worstOverlap: 0 };
  }

  const wordSets = entryTexts.map((text) => extractSignificantWords(text));
  let duplicatePairs = 0;
  let totalPairs = 0;
  let worstOverlap = 0;

  for (let i = 0; i < wordSets.length; i++) {
    for (let j = i + 1; j < wordSets.length; j++) {
      totalPairs++;
      const setA = wordSets[i];
      const setB = wordSets[j];
      if (setA.size === 0 || setB.size === 0) continue;

      let overlap = 0;
      const smaller = setA.size <= setB.size ? setA : setB;
      const larger = setA.size > setB.size ? setA : setB;

      for (const word of smaller) {
        if (larger.has(word)) overlap++;
      }

      const overlapRatio = overlap / Math.max(smaller.size, 1);
      if (overlapRatio > worstOverlap) worstOverlap = overlapRatio;
      if (overlapRatio > 0.7) duplicatePairs++;
    }
  }

  // Flag if more than 50% of entry pairs are duplicates
  const repetitive = totalPairs > 0 && duplicatePairs / totalPairs > 0.5;
  return { repetitive, duplicatePairs, totalPairs, worstOverlap };
}

// ── 8. Hallucinated Metrics Detection ────────────────
// v2 quality guard: detect when LLM invents numbers not in original

export interface HallucinatedMetricsResult {
  count: number;
  metrics: string[];
  severity: "none" | "low" | "high";
}

/**
 * Detect potentially hallucinated metrics in rewritten text.
 * Compares numeric patterns (percentages, dollar amounts, large numbers)
 * in the rewrite against the original. Metrics not in the original are suspicious.
 *
 * Returns detailed result with specific hallucinated metrics and severity.
 * Severity: 0 = none, 1-2 = low, 3+ = high.
 * Logging-only diagnostic.
 */
export function detectHallucinatedMetrics(
  original: string,
  rewritten: string
): HallucinatedMetricsResult {
  if (!original || !rewritten) {
    return { count: 0, metrics: [], severity: "none" };
  }

  // Extract metric patterns: percentages, dollar amounts, large numbers (1000+)
  const METRIC_RE = /(?:\$[\d,.]+[KMBkmb]?|\d+(?:\.\d+)?%|\d{1,3}(?:,\d{3})+|\d{4,}(?:\.\d+)?[KMBkmb]?)/g;

  const originalMetrics = new Set(
    (original.match(METRIC_RE) || []).map((m) => m.toLowerCase().replace(/,/g, ""))
  );
  const rewrittenMetrics =
    (rewritten.match(METRIC_RE) || []).map((m) => m.toLowerCase().replace(/,/g, ""));

  const hallucinated: string[] = [];
  for (const metric of rewrittenMetrics) {
    if (!originalMetrics.has(metric)) {
      hallucinated.push(metric);
    }
  }

  const count = hallucinated.length;
  const severity: "none" | "low" | "high" =
    count === 0 ? "none" : count <= 2 ? "low" : "high";

  return { count, metrics: hallucinated, severity };
}

// ── 9. Buzzword Detection ────────────────────────────
// Sprint 1: detect overused LinkedIn/CV buzzwords

/**
 * Known buzzword blacklist from research. These are the most overused
 * LinkedIn/CV descriptors that raise AI-detection red flags with recruiters.
 *
 * Note: "spearheaded" is excluded — acceptable as an action verb in bullets,
 * only problematic as a standalone descriptor. Handled contextually in prompts.
 */
const BUZZWORD_BLACKLIST = [
  "results-driven", "passionate", "strategic thinker", "thought leader",
  "guru", "ninja", "rockstar", "seasoned professional", "seasoned",
  "experienced leader", "motivated", "leveraging", "synergies",
  "cutting-edge", "innovative leader",
];

/**
 * Detect buzzword violations in text.
 * Returns array of detected buzzwords (lowercase). Logging-only diagnostic.
 */
export function detectBuzzwords(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return BUZZWORD_BLACKLIST.filter((bw) => lower.includes(bw));
}

// ── 10. Metric Tag Counter ───────────────────────────
// Sprint 1: verify LLM is using [ADD_METRIC] / [NEEDS_VERIFICATION] tags

export interface MetricTagCounts {
  addMetric: number;
  needsVerification: number;
}

/**
 * Count [ADD_METRIC] and [NEEDS_VERIFICATION] tags in output.
 * Used for diagnostics — verifies the LLM is actually using the tag system
 * introduced in Sprint 1 prompts.
 */
export function countMetricTags(text: string): MetricTagCounts {
  if (!text) return { addMetric: 0, needsVerification: 0 };
  const addMetric = (text.match(/\[ADD_METRIC\]/gi) || []).length;
  const needsVerification = (text.match(/\[NEEDS_VERIFICATION\]/gi) || []).length;
  return { addMetric, needsVerification };
}

// ── 11. CV Document Word Count ───────────────────────
// Sprint 1: evaluate full CV word count against optimal 475-600 range

export interface CvWordCountResult {
  wordCount: number;
  inRange: boolean;
}

/**
 * Evaluate full CV document word count against optimal 475-600 word range.
 * Takes all CV section texts concatenated. Document-level check, NOT per-section.
 * Called once per request after all CV rewrites are assembled.
 * Logging-only diagnostic.
 */
export function checkCvDocumentWordCount(sectionTexts: string[]): CvWordCountResult {
  const combined = sectionTexts.join(" ");
  const wordCount = combined.trim().split(/\s+/).filter((w) => w.length > 0).length;
  return { wordCount, inRange: wordCount >= 475 && wordCount <= 600 };
}
