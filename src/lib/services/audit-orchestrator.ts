import type {
  PlanId,
  Locale,
  ProfileResult,
  ScoreSection,
  RewritePreview,
  RewriteEntry,
  CoverLetterResult,
  ScoreTier,
  EntryScore,
} from "@/lib/types";
import { callLLM, LLM_MODEL_FAST, LLM_MODEL_QUALITY } from "./llm-client";
import {
  getActivePromptWithVersion,
  interpolatePrompt,
} from "./prompt-resolver";
import {
  AuditSectionOutput,
  RewriteSectionOutput,
  RewriteSectionWithEntriesOutput,
  OverallDescriptorOutput,
  CoverLetterOutput,
  BatchEntryScoreOutput,
  normalizeTier,
  tierFromScore,
  extractJson,
  normalizeAuditOutput,
} from "@/lib/schemas/llm-output";
import {
  parseLinkedinSectionsWithFallback,
  parseLinkedinWithStructuring,
  parseEntriesFromSection,
  LINKEDIN_SECTION_IDS,
  CV_SECTION_IDS,
  SECTION_DISPLAY_NAMES,
  MAX_ENTRIES_PER_SECTION,
  MAX_CHARS_PER_ENTRY,
  estimateSectionEntryCount,
} from "./linkedin-parser";
import type { ParsedEntry } from "./linkedin-parser";
import { parseLinkedinExperienceArchetype } from "./linkedin-experience-archetype";
import { detectProfileLanguage, isOutputInTargetLocale } from "@/lib/utils/language-detect";
import {
  hasRepetitiveEntryContent,
  detectHallucinatedMetrics,
  detectBuzzwords,
  countMetricTags,
  checkCvDocumentWordCount,
  computeInputOverlap,
} from "./generation-guards";
import { mockResults } from "@/lib/mock/results";
import { trackServerEvent } from "@/lib/analytics/server-tracker";
import {
  computeInputHash,
  getCachedResult,
  setCachedResult,
} from "./result-cache";
import {
  getUnlockedLinkedinIds,
  getUnlockedCvIds,
  isCoverLetterUnlockedForPlan,
} from "./unlock-matrix";
import {
  isMockSection,
  isMockRewrite,
  isPlaceholderContent,
  validateSectionCompleteness,
  stripNonFlagEmojis,
  isOverallDescriptorDuplicate,
} from "./generation-guards";
import { getFallbackSuggestions } from "@/lib/utils/fallback-suggestions";

// ── Failure reason categories (P0-1: structured diagnostics) ──
export type FailureReason =
  | "timeout"
  | "rate_limit_429"
  | "invalid_json"
  | "invalid_json_too_big"
  | "missing_prompt"
  | "empty_input"
  | "parser_fail"
  | "circuit_breaker_open"
  | "mock_fingerprint_retry"
  | "generic_output_retry"
  | "normalized_suggestions"
  | "retry_too_big_success"
  | "lang_drift_retry"
  | "unknown";

// ── PR2C: Per-section failure reason taxonomy ──
export type SectionFailureReason =
  | "prompt_missing"
  | "prompt_inactive"
  | "locale_missing"
  | "llm_timeout"
  | "llm_rate_limited"
  | "llm_schema_invalid"
  | "llm_empty_output"
  | "guard_rejected"
  | "retry_exhausted";

export interface SectionDiagnostic {
  sectionId: string;
  module: "score" | "rewrite" | "cover-letter" | "descriptor";
  source: "linkedin" | "cv" | "system";
  isCore: boolean;
  reason: SectionFailureReason;
  attempts: number;
  durationMs: number;
}

// ── PR2C: Core section definitions ──
// Core sections are the ones that carry the most signal. If these fail,
// the entire generation is unreliable and should surface an explicit error.
const CORE_LINKEDIN_SECTIONS = new Set(["headline", "about", "experience", "education"]);
const CORE_CV_SECTIONS = new Set(["professional-summary", "work-experience", "education-section"]);

function isCoreSection(sectionId: string, source: "linkedin" | "cv"): boolean {
  return source === "linkedin"
    ? CORE_LINKEDIN_SECTIONS.has(sectionId)
    : CORE_CV_SECTIONS.has(sectionId);
}

// ── PR2C: Error classification for retry decisions ──
type ErrorClass = "transient" | "hard" | "guard";

function classifyError(err: unknown): { reason: FailureReason; errorClass: ErrorClass } {
  if (!(err instanceof Error)) return { reason: "unknown", errorClass: "hard" };
  const msg = err.message.toLowerCase();
  if (msg.includes("circuit breaker")) return { reason: "circuit_breaker_open", errorClass: "hard" };
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("rate_limit"))
    return { reason: "rate_limit_429", errorClass: "transient" };
  if (msg.includes("abort") || msg.includes("timeout") || msg.includes("timed out"))
    return { reason: "timeout", errorClass: "transient" };
  if (msg.includes("overloaded") || msg.includes("econnreset") || msg.includes("socket hang up"))
    return { reason: "timeout", errorClass: "transient" };
  if (msg.includes("json") || msg.includes("parse"))
    return { reason: "invalid_json", errorClass: "hard" };
  return { reason: "unknown", errorClass: "hard" };
}

/** Backward-compat wrapper — kept for non-score code paths */
function categorizeError(err: unknown): FailureReason {
  return classifyError(err).reason;
}

// ── PR2C: Per-section time budget ──
// Prevents long-tail latency from unbounded retries on a single section.
const SECTION_BUDGET_FAST_MS = 25_000;   // scoring (Haiku)
const SECTION_BUDGET_QUALITY_MS = 50_000; // rewriting (Sonnet)

// HOTFIX-5: Per-rewrite hard timeout (20s) — prevents individual LLM calls from stalling
const REWRITE_CALL_TIMEOUT_MS = 20_000;

// HOTFIX-9: Removed first-pass cap — process ALL parsed entries (was 4 in HOTFIX-5)
const MAX_ENTRIES_FIRST_PASS = 20;

// PERF-HOTFIX-2: Global orchestration time budget — skip non-essential stages if exceeded
const ORCHESTRATION_BUDGET_MS = 45_000;

// ── Feature flags ──
const ENABLE_STRUCTURING_PASS = process.env.ENABLE_STRUCTURING_PASS === "true";
const ENABLE_ENTRY_SCORING = process.env.ENABLE_ENTRY_SCORING === "true";
const ENABLE_PROGRESSIVE_GENERATION = process.env.ENABLE_PROGRESSIVE_GENERATION === "true";

// ── Progressive generation types ──────────────────────────
export type ProgressStage =
  | "cache_check"
  | "extracting_input"
  | "structuring_profile"
  | "auditing_sections"
  | "generating_rewrites"
  | "scoring_entries"
  | "generating_extras"
  | "finalizing_results";

export interface ProgressEvent {
  stage: ProgressStage;
  percent: number;
  label?: string;
  sectionReady?: {
    section: ScoreSection;
    rewrite: RewritePreview;
  };
  completedSections?: number;
  totalSections?: number;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ── Stage timer for observability ─────────────────────────
interface StageTiming {
  stage: string;
  durationMs: number;
}

class StageTimer {
  private timings: StageTiming[] = [];
  private current: { stage: string; startMs: number } | null = null;

  start(stage: string) {
    if (this.current) this.end();
    this.current = { stage, startMs: Date.now() };
  }
  end() {
    if (!this.current) return;
    this.timings.push({
      stage: this.current.stage,
      durationMs: Date.now() - this.current.startMs,
    });
    this.current = null;
  }
  getTimings(): Record<string, number> {
    if (this.current) this.end();
    const result: Record<string, number> = {};
    for (const t of this.timings) result[t.stage] = t.durationMs;
    return result;
  }
}

// ── Degraded threshold ──
// If ≥ this fraction of total expected sections are fallbacks, results are degraded
const DEGRADED_FALLBACK_THRESHOLD = 0.3; // 30% or more fallbacks = degraded

// ── Input type ──────────────────────────────────────────
export interface AuditInput {
  linkedinText: string;
  cvText?: string;
  jobDescription: string;
  targetAudience: string;
  objectiveMode: "job" | "objective";
  objectiveText: string;
  planId: PlanId | null;
  isAdmin: boolean;
  /** P0-4: bypass cache and force fresh generation */
  forceFresh?: boolean;
  /** Whether LinkedIn input came from a PDF upload (enables structuring pass) */
  isPdfSource?: boolean;
}

// ── Generation metadata (enhanced for integrity tracking) ──
export interface GenerationMeta {
  modelUsed: string;
  promptVersionsUsed: Record<string, number>;
  durationMs: number;
  fallbackCount: number;
  hasFallback: boolean;
  /** Number of sections actually generated (audit + rewrite) */
  sectionCountGenerated: number;
  /** Number of mock leaks detected and replaced */
  mockLeaksDetected: number;
  /** P0-2: true when fallbackCount is high enough to be unreliable */
  degraded: boolean;
  /** P0-1: categorized failure reasons for every failed step */
  failureReasons: FailureReason[];
  /** PR2C: count of suggestions normalized before Zod parse (trimmed/deduped/capped) */
  normalizedSuggestionsCount: number;
  /** PR2C: count of invalid_json failures caused by oversized output */
  invalidJsonTooBigCount: number;
  /** PR2C: count of targeted too_big retries that succeeded */
  retryTooBigSuccessCount: number;
  /** PR2C-post: per-section failure diagnostics */
  sectionDiagnostics: SectionDiagnostic[];
  /** PR2C-post: failures in core sections (headline, about, experience, education) */
  coreFailureCount: number;
  /** PR2C-post: failures in non-core sections (skills, certifications, recommendations) */
  nonCoreFailureCount: number;
  /** PR2C-post: distribution of failure reasons across all failed sections */
  fallbackReasonDistribution: Record<string, number>;
  /** PR2C-post: retry attempts grouped by error class */
  retryAttemptsByReason: Record<string, number>;
  /** PR2C-post: total wall-clock time spent in LLM calls */
  totalLLMTimeMs: number;
  /** PR2C-post: prompt keys that passed readiness preflight */
  preflightResult: { passed: boolean; missing: string[] };
  /** v1: Whether LLM structuring pass was used for parsing */
  structuringUsed: boolean;
  structuringDurationMs: number;
  /** v1: Detected profile language from heuristic analysis */
  detectedLanguage?: "en" | "es" | "unknown";
  languageConfidence?: number;
  /** v1: Quality guard diagnostics */
  repetitiveEntryCount: number;
  hallucinatedMetricCount: number;
  /** v2: Entry-level scoring diagnostics */
  entryScoringSectionCount: number;
  entryScoringSuccessCount: number;
  entryScoringFailCount: number;
  entryScoringDurationMs: number;
  /** Sprint 2: Stage-level timing */
  stageTimings?: Record<string, number>;
  timeToFirstProgressMs?: number;
  timeToFirstSectionMs?: number;
  llmCallCount?: number;
  sectionsSkipped?: number;
  /** PERF-HOTFIX: Experience rewrite mode used */
  experienceRewriteMode?: "full_sonnet" | "fast_section" | "passthrough";
  /** PERF-HOTFIX: Reason experience rewrite was skipped or fell through */
  experienceRewriteSkippedReason?: string;
  /** PERF-HOTFIX: Number of entries deferred for on-demand Sonnet */
  deferredExperienceEntries?: number;
  /** PERF-HOTFIX-2: Reason structuring was skipped (e.g. archetype_high_confidence) */
  structuringSkippedReason?: string;
  /** PERF-HOTFIX-2: Total experience entries found */
  totalExperienceEntries?: number;
  /** PERF-HOTFIX-2: Entries processed in first pass */
  firstPassProcessedEntries?: number;
  /** PERF-HOTFIX-2: "fast" when headline/summary use Haiku first-pass */
  firstPassMode?: "fast" | "full";
  /** PERF-HOTFIX-2: Section IDs deferred for Sonnet enhancement */
  deferredEnhancements?: string[];
  /** PERF-HOTFIX-2: Wall-clock budget used (ms) */
  timeBudgetMs?: number;
  /** PERF-HOTFIX-2: Whether time budget was triggered */
  timeBudgetTriggered?: boolean;
  /** PERF-HOTFIX-2: Stages skipped due to time budget */
  skippedStages?: string[];
  /** HOTFIX-CV-ONLY-ROUTING: CV first-pass mode */
  cvFirstPassMode?: "fast" | "full";
}

export interface GenerationResult {
  results: ProfileResult;
  meta: GenerationMeta;
}

// ── Privacy: max input length per section ───────────────
// HOTFIX-9b: Raised from 10K → 25K to prevent truncation of entry-heavy sections
const MAX_SECTION_CHARS = 25_000;

// HOTFIX-4: Truncation tracking for diagnostics
interface TruncationEntry { sectionId: string; originalChars: number; keptChars: number }
let _truncationLog: TruncationEntry[] = [];

function truncate(text: string, max: number = MAX_SECTION_CHARS, sectionId?: string): string {
  if (text.length > max) {
    if (sectionId) _truncationLog.push({ sectionId, originalChars: text.length, keptChars: max });
    return text.slice(0, max) + "…";
  }
  return text;
}

// ── Determine target role from input ────────────────────
function getTargetRole(input: AuditInput): string {
  if (input.objectiveMode === "job" && input.jobDescription) {
    // Extract a short role description from job description
    const firstLine = input.jobDescription.split("\n")[0].trim();
    return firstLine.length > 150 ? firstLine.slice(0, 150) : firstLine;
  }
  return input.objectiveText || input.targetAudience || "Professional";
}

// ── Objective framing for prompts ───────────────────────
interface ObjectiveFraming {
  objective_mode_label: string;
  objective_framing: string;
  objective_context: string;
}

function getObjectiveFraming(input: AuditInput): ObjectiveFraming {
  if (input.objectiveMode === "job") {
    return {
      objective_mode_label: "Target role",
      objective_framing:
        "Optimize for recruiter visibility, ATS compatibility, and job-market competitiveness",
      objective_context:
        input.jobDescription || input.targetAudience || "Professional role",
    };
  }
  // Objective / growth mode
  return {
    objective_mode_label: "Objective",
    objective_framing: `Optimize for the stated objective: ${(input.objectiveText || "General professional growth").slice(0, 200)}`,
    objective_context:
      input.objectiveText || "General professional growth",
  };
}

// ── Score a single section via LLM ──────────────────────
async function scoreSection(
  sectionId: string,
  sectionContent: string,
  promptKey: string,
  targetRole: string,
  framing: ObjectiveFraming,
  locale: Locale,
  promptVersions: Record<string, number>,
  failureReasons: FailureReason[],
  sectionDiagnostics: SectionDiagnostic[],
  retryAttemptsByReason: Record<string, number>
): Promise<{ section: ScoreSection; modelUsed: string } | null> {
  const sectionStart = Date.now();
  const source: "linkedin" | "cv" = promptKey.includes("linkedin") ? "linkedin" : "cv";
  const isCore = isCoreSection(sectionId, source);

  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) {
    failureReasons.push("missing_prompt");
    const reason: SectionFailureReason = "prompt_missing";
    sectionDiagnostics.push({
      sectionId, module: "score", source, isCore, reason,
      attempts: 0, durationMs: Date.now() - sectionStart,
    });
    console.error(`[diag] Missing prompt: key=${promptKey}, locale=${locale}, section=${sectionId}`);
    return null;
  }

  promptVersions[promptKey] = prompt.version;

  const systemPrompt = interpolatePrompt(prompt.content, {
    section_name: SECTION_DISPLAY_NAMES[sectionId] ?? sectionId,
    section_content: truncate(sectionContent, MAX_SECTION_CHARS, sectionId),
    target_role: targetRole,
    objective_mode_label: framing.objective_mode_label,
    objective_framing: framing.objective_framing,
    objective_context: framing.objective_context,
  });

  // PR2C: retry with error-class matrix + per-section time budget
  let lastTooBig = false;
  let lastErrorClass: ErrorClass = "hard";
  let lastSectionReason: SectionFailureReason = "retry_exhausted";
  let totalAttempts = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    // Per-section time budget — abort if we've already spent too long
    if (Date.now() - sectionStart > SECTION_BUDGET_FAST_MS) {
      console.warn(`[diag] Section budget exceeded for score/${sectionId} after ${attempt} attempts`);
      lastSectionReason = "llm_timeout";
      break;
    }

    // Attempt 2 only fires for too_big or transient errors
    if (attempt === 2 && !lastTooBig && lastErrorClass !== "transient") break;

    // No retry on hard errors (prompt missing, guard rejected, schema hard-fail after normalization)
    if (attempt > 0 && lastErrorClass === "guard") break;

    totalAttempts = attempt + 1;

    try {
      const userMessage =
        attempt === 0
          ? "Score this section and provide actionable feedback."
          : attempt === 1
            ? "Your previous response was not valid JSON. Please respond with ONLY a valid JSON object with keys: score, tier, explanation, suggestions."
            : "Return valid JSON. CRITICAL: each suggestion must be ONE sentence, max 180 characters. Max 3 suggestions total.";

      const systemSuffix =
        attempt === 0
          ? ""
          : attempt === 1
            ? "\n\nIMPORTANT: Respond with ONLY valid JSON, no other text."
            : "\n\nCRITICAL: Respond with ONLY valid JSON. Each suggestion MUST be under 180 characters. Max 3 suggestions. One actionable point per suggestion.";

      const result = await callLLM({
        model: LLM_MODEL_FAST,
        systemPrompt: systemPrompt + systemSuffix,
        userMessage,
      });

      // Check for empty output
      if (!result.text || result.text.trim().length < 5) {
        failureReasons.push("invalid_json");
        lastErrorClass = "hard";
        lastSectionReason = "llm_empty_output";
        retryAttemptsByReason["llm_empty_output"] = (retryAttemptsByReason["llm_empty_output"] || 0) + 1;
        console.warn(`[diag] Empty LLM output: section=${sectionId}, attempt=${attempt + 1}`);
        continue;
      }

      const jsonStr = extractJson(result.text);
      let rawParsed: unknown;
      try {
        rawParsed = JSON.parse(jsonStr);
      } catch {
        // JSON.parse failure is retryable — attempt 2 adds explicit JSON instruction
        failureReasons.push("invalid_json");
        lastErrorClass = "transient"; // Allow retry
        lastSectionReason = "llm_schema_invalid";
        retryAttemptsByReason["invalid_json"] = (retryAttemptsByReason["invalid_json"] || 0) + 1;
        console.warn(`[diag] JSON parse failed: section=${sectionId}, attempt=${attempt + 1}, raw=${jsonStr.slice(0, 100)}`);
        continue;
      }

      // Normalize before Zod validation
      const { normalized, data: normalizedData } = normalizeAuditOutput(rawParsed);
      if (normalized) {
        failureReasons.push("normalized_suggestions");
        retryAttemptsByReason["normalized_suggestions"] = (retryAttemptsByReason["normalized_suggestions"] || 0) + 1;
        console.log(`[diag] Normalized audit output for section=${sectionId} (attempt ${attempt + 1})`);
      }

      const parsed = AuditSectionOutput.safeParse(normalizedData);

      if (parsed.success) {
        if (attempt === 2) failureReasons.push("retry_too_big_success");

        const section: ScoreSection = {
          id: sectionId,
          score: parsed.data.score,
          maxScore: 100,
          tier: normalizeTier(parsed.data.tier),
          locked: false,
          source,
          explanation: parsed.data.explanation,
          improvementSuggestions: parsed.data.suggestions,
        };

        // Anti-placeholder guard
        if (isMockSection(section)) {
          console.warn(
            `[guard] Mock fingerprint detected in scored section ${sectionId} (attempt ${attempt + 1}), retrying`
          );
          failureReasons.push("mock_fingerprint_retry");
          lastErrorClass = "guard";
          lastSectionReason = "guard_rejected";
          retryAttemptsByReason["guard_rejected"] = (retryAttemptsByReason["guard_rejected"] || 0) + 1;
          continue;
        }

        return { section, modelUsed: result.modelUsed };
      }

      // Schema validation failed after normalization
      const errorMsg = parsed.error?.message ?? "";
      const rawObj = rawParsed as Record<string, unknown>;
      const isTooBig =
        errorMsg.includes("too_big") ||
        errorMsg.includes("String must contain at most") ||
        (Array.isArray(rawObj?.suggestions) &&
          (rawObj.suggestions as unknown[]).some((s: unknown) => typeof s === "string" && (s as string).length > 500));
      lastTooBig = isTooBig;
      lastErrorClass = "hard";
      lastSectionReason = "llm_schema_invalid";

      failureReasons.push(isTooBig ? "invalid_json_too_big" : "invalid_json");
      retryAttemptsByReason[isTooBig ? "invalid_json_too_big" : "llm_schema_invalid"] =
        (retryAttemptsByReason[isTooBig ? "invalid_json_too_big" : "llm_schema_invalid"] || 0) + 1;
      console.warn(
        `[diag] Audit parse failed: section=${sectionId}, attempt=${attempt + 1}, tooBig=${isTooBig}, error=${errorMsg.slice(0, 200)}`
      );
    } catch (err) {
      const { reason, errorClass } = classifyError(err);
      failureReasons.push(reason);
      lastTooBig = false;
      lastErrorClass = errorClass;
      lastSectionReason = reason === "timeout" ? "llm_timeout"
        : reason === "rate_limit_429" ? "llm_rate_limited"
        : "retry_exhausted";
      retryAttemptsByReason[reason] = (retryAttemptsByReason[reason] || 0) + 1;
      console.warn(
        `[diag] Audit LLM error: section=${sectionId}, attempt=${attempt + 1}, reason=${reason}, class=${errorClass}, error=${err instanceof Error ? err.message : "Unknown"}`
      );

      // Don't retry hard errors (circuit breaker open, auth failures)
      if (errorClass === "hard") break;
    }
  }

  // Record section diagnostic
  sectionDiagnostics.push({
    sectionId, module: "score", source, isCore, reason: lastSectionReason,
    attempts: totalAttempts, durationMs: Date.now() - sectionStart,
  });

  return null;
}

// ── Score individual entries within a section (v2) ───────
// One Haiku call per section, max 4 entries, 1200 chars each.
// Returns null on any failure (soft fail — section score still valid).
async function scoreSectionWithEntries(
  sectionId: string,
  entries: ParsedEntry[],
  promptKey: string,
  targetRole: string,
  framing: ObjectiveFraming,
  locale: Locale,
  promptVersions: Record<string, number>,
  failureReasons: FailureReason[],
  sectionDiagnostics: SectionDiagnostic[],
  retryAttemptsByReason: Record<string, number>
): Promise<EntryScore[] | null> {
  const ENTRY_SCORING_MAX_ENTRIES = 4;
  const ENTRY_SCORING_MAX_CHARS = 1_200;
  const sectionStart = Date.now();

  // Cap entries and per-entry length
  const cappedEntries = entries.slice(0, ENTRY_SCORING_MAX_ENTRIES).map((e) => ({
    title: e.title,
    organization: e.organization,
    dateRange: e.dateRange,
    description: e.description.slice(0, ENTRY_SCORING_MAX_CHARS),
  }));

  const entriesJson = JSON.stringify(cappedEntries, null, 2);

  // Resolve prompt
  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) {
    console.warn(
      `[diag] entry_scoring: section=${sectionId}, prompt=${promptKey} not found — skipping`
    );
    return null;
  }
  promptVersions[promptKey] = prompt.version;

  const sectionName = SECTION_DISPLAY_NAMES[sectionId] ?? sectionId;
  const systemPrompt = interpolatePrompt(prompt.content, {
    section_name: sectionName,
    entries_json: entriesJson,
    entry_count: String(cappedEntries.length),
    target_role: targetRole,
    objective_mode_label: framing.objective_mode_label,
    objective_framing: framing.objective_framing,
    objective_context: framing.objective_context,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    const elapsed = Date.now() - sectionStart;
    if (elapsed > SECTION_BUDGET_FAST_MS) {
      console.warn(
        `[diag] entry_scoring: section=${sectionId}, budget exhausted after ${elapsed}ms`
      );
      break;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        SECTION_BUDGET_FAST_MS - elapsed
      );

      const userMessage =
        attempt === 0
          ? `Score each of the ${cappedEntries.length} entries individually. Return ONLY valid JSON.`
          : `Score each entry. Respond ONLY with valid JSON matching the schema. No explanation, no markdown, just JSON.`;

      try {
        const result = await callLLM({
          model: LLM_MODEL_FAST,
          systemPrompt,
          userMessage,
          maxTokens: 2048,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const jsonStr = extractJson(result.text);
        const parsed = JSON.parse(jsonStr);
        const validated = BatchEntryScoreOutput.safeParse(parsed);

        if (validated.success) {
          const entryScores: EntryScore[] = validated.data.entries.map((e) => ({
            entryTitle: e.entryTitle,
            score: e.score,
            whyThisScore: e.whyThisScore,
            thingsToChange: e.thingsToChange,
            missingFromThisEntry: e.missingFromThisEntry,
          }));

          console.log(
            `[diag] entry_scoring: section=${sectionId}, entries=${cappedEntries.length}, ` +
            `success=true, duration=${Date.now() - sectionStart}ms`
          );

          return entryScores;
        }

        // Zod validation failed — retry with stricter prompt
        console.warn(
          `[diag] entry_scoring: section=${sectionId}, attempt=${attempt + 1}, zod_fail`
        );
        retryAttemptsByReason["entry_scoring_invalid_json"] =
          (retryAttemptsByReason["entry_scoring_invalid_json"] || 0) + 1;
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      const { reason } = classifyError(err);
      console.warn(
        `[diag] entry_scoring: section=${sectionId}, attempt=${attempt + 1}, error=${reason}`
      );
      // Don't retry on hard errors
      if (reason !== "invalid_json") break;
    }
  }

  console.log(
    `[diag] entry_scoring: section=${sectionId}, entries=${cappedEntries.length}, ` +
    `success=false, duration=${Date.now() - sectionStart}ms`
  );

  return null; // Soft fail
}

// ── Rewrite a single section via LLM ────────────────────
async function rewriteSection(
  sectionId: string,
  originalContent: string,
  promptKey: string,
  targetRole: string,
  jobObjective: string,
  framing: ObjectiveFraming,
  locale: Locale,
  promptVersions: Record<string, number>,
  failureReasons: FailureReason[],
  sectionDiagnostics: SectionDiagnostic[],
  retryAttemptsByReason: Record<string, number>
): Promise<{ rewrite: RewritePreview; modelUsed: string } | null> {
  const sectionStart = Date.now();
  const source: "linkedin" | "cv" = promptKey.includes("linkedin") ? "linkedin" : "cv";
  const isCore = isCoreSection(sectionId, source);

  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) {
    failureReasons.push("missing_prompt");
    const reason: SectionFailureReason = "prompt_missing";
    sectionDiagnostics.push({
      sectionId, module: "rewrite", source, isCore, reason,
      attempts: 0, durationMs: Date.now() - sectionStart,
    });
    console.error(`[diag] Missing prompt: key=${promptKey}, locale=${locale}, section=${sectionId}`);
    return null;
  }

  promptVersions[promptKey] = prompt.version;

  const systemPrompt = interpolatePrompt(prompt.content, {
    section_name: SECTION_DISPLAY_NAMES[sectionId] ?? sectionId,
    original_content: truncate(originalContent, MAX_SECTION_CHARS, sectionId),
    target_role: targetRole,
    job_objective: jobObjective,
    objective_mode_label: framing.objective_mode_label,
    objective_framing: framing.objective_framing,
    objective_context: framing.objective_context,
  });

  let lastErrorClass: ErrorClass = "hard";
  let lastSectionReason: SectionFailureReason = "retry_exhausted";
  let totalAttempts = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    // Per-section time budget
    if (Date.now() - sectionStart > SECTION_BUDGET_QUALITY_MS) {
      console.warn(`[diag] Section budget exceeded for rewrite/${sectionId} after ${attempt} attempts`);
      lastSectionReason = "llm_timeout";
      break;
    }

    // Don't retry hard errors
    if (attempt > 0 && lastErrorClass === "hard") break;

    totalAttempts = attempt + 1;

    try {
      // HOTFIX-2: Explicit language instruction for non-English locales
      const langInstruction = locale !== "en"
        ? " ALL output text (original, improvements, missingSuggestions, rewritten) MUST be in Spanish."
        : "";

      const userMessage =
        attempt === 0
          ? `Rewrite this section. Respond in JSON format with keys: original, improvements, missingSuggestions, rewritten.${langInstruction}`
          : `Your previous response was not valid JSON. Please respond with ONLY a valid JSON object with keys: original, improvements, missingSuggestions, rewritten.${langInstruction}`;

      // HOTFIX-5 D.9: Per-rewrite 20s hard timeout
      const rewriteController = new AbortController();
      const rewriteTimeout = setTimeout(() => rewriteController.abort(), REWRITE_CALL_TIMEOUT_MS);
      let result;
      try {
        result = await callLLM({
          model: LLM_MODEL_QUALITY,
          systemPrompt: attempt === 0 ? systemPrompt : systemPrompt + "\n\nIMPORTANT: Respond with ONLY valid JSON, no other text.",
          userMessage,
          maxTokens: 4096,
          signal: rewriteController.signal,
        });
      } finally {
        clearTimeout(rewriteTimeout);
      }

      // Empty output check
      if (!result.text || result.text.trim().length < 5) {
        failureReasons.push("invalid_json");
        lastErrorClass = "hard";
        lastSectionReason = "llm_empty_output";
        retryAttemptsByReason["llm_empty_output"] = (retryAttemptsByReason["llm_empty_output"] || 0) + 1;
        console.warn(`[diag] Empty rewrite output: section=${sectionId}, attempt=${attempt + 1}`);
        continue;
      }

      const jsonStr = extractJson(result.text);
      let rawRewriteParsed: unknown;
      try {
        rawRewriteParsed = JSON.parse(jsonStr);
      } catch {
        failureReasons.push("invalid_json");
        lastErrorClass = "transient"; // Allow retry
        lastSectionReason = "llm_schema_invalid";
        retryAttemptsByReason["invalid_json"] = (retryAttemptsByReason["invalid_json"] || 0) + 1;
        console.warn(`[diag] Rewrite JSON parse failed: section=${sectionId}, attempt=${attempt + 1}`);
        continue;
      }
      const parsed = RewriteSectionOutput.safeParse(rawRewriteParsed);

      if (parsed.success) {
        const rewrite: RewritePreview = {
          sectionId,
          source,
          original: parsed.data.original,
          improvements: parsed.data.improvements,
          missingSuggestions: parsed.data.missingSuggestions,
          rewritten: stripNonFlagEmojis(parsed.data.rewritten),
          locked: false, // locking applied later
        };

        // HOTFIX-9b: Ensure missingSuggestions is never empty (also filter empty strings)
        rewrite.missingSuggestions = (rewrite.missingSuggestions ?? []).filter((s) => s.trim().length > 0);
        if (rewrite.missingSuggestions.length === 0) {
          rewrite.missingSuggestions = getFallbackSuggestions(sectionId);
        }

        // Anti-placeholder guard
        if (isMockRewrite(rewrite)) {
          console.warn(
            `[guard] Mock fingerprint detected in rewrite ${sectionId} (attempt ${attempt + 1}), retrying`
          );
          failureReasons.push("mock_fingerprint_retry");
          lastErrorClass = "guard";
          lastSectionReason = "guard_rejected";
          retryAttemptsByReason["guard_rejected"] = (retryAttemptsByReason["guard_rejected"] || 0) + 1;
          continue;
        }

        // HOTFIX-2: Language drift detection — retry if rewrite is in wrong language
        if (locale !== "en" && attempt === 0 && !isOutputInTargetLocale(rewrite.rewritten, locale)) {
          console.warn(
            `[lang-guard] Language drift in rewrite ${sectionId} (attempt ${attempt + 1}), retrying`
          );
          failureReasons.push("lang_drift_retry");
          retryAttemptsByReason["lang_drift"] = (retryAttemptsByReason["lang_drift"] || 0) + 1;
          continue;
        }

        return { rewrite, modelUsed: result.modelUsed };
      }

      failureReasons.push("invalid_json");
      lastErrorClass = "hard";
      lastSectionReason = "llm_schema_invalid";
      retryAttemptsByReason["llm_schema_invalid"] = (retryAttemptsByReason["llm_schema_invalid"] || 0) + 1;
      console.warn(
        `[diag] Rewrite parse failed: section=${sectionId}, attempt=${attempt + 1}, error=${parsed.error?.message}`
      );
    } catch (err) {
      const { reason, errorClass } = classifyError(err);
      failureReasons.push(reason);
      lastErrorClass = errorClass;
      lastSectionReason = reason === "timeout" ? "llm_timeout"
        : reason === "rate_limit_429" ? "llm_rate_limited"
        : "retry_exhausted";
      retryAttemptsByReason[reason] = (retryAttemptsByReason[reason] || 0) + 1;
      console.warn(
        `[diag] Rewrite LLM error: section=${sectionId}, attempt=${attempt + 1}, reason=${reason}, class=${errorClass}, error=${err instanceof Error ? err.message : "Unknown"}`
      );

      if (errorClass === "hard") break;
    }
  }

  // Record section diagnostic on failure
  sectionDiagnostics.push({
    sectionId, module: "rewrite", source, isCore, reason: lastSectionReason,
    attempts: totalAttempts, durationMs: Date.now() - sectionStart,
  });

  return null;
}

// ── Rewrite a section with per-entry breakdown (experience/education) ──
// Cost controls: max MAX_ENTRIES_PER_SECTION entries, each truncated to MAX_CHARS_PER_ENTRY
async function rewriteSectionWithEntries(
  sectionId: string,
  entries: ParsedEntry[],
  fullSectionContent: string,
  promptKey: string,
  targetRole: string,
  jobObjective: string,
  framing: ObjectiveFraming,
  locale: Locale,
  promptVersions: Record<string, number>,
  failureReasons: FailureReason[],
  sectionDiagnostics: SectionDiagnostic[],
  retryAttemptsByReason: Record<string, number>
): Promise<{ rewrite: RewritePreview; modelUsed: string } | null> {
  // HOTFIX-5 D.8: First-pass entry cap for fast initial results
  // Cap to MAX_ENTRIES_FIRST_PASS for initial response speed; remaining entries
  // are available for on-demand regeneration.
  const firstPassCap = Math.min(MAX_ENTRIES_FIRST_PASS, MAX_ENTRIES_PER_SECTION);
  const cappedEntries = entries.slice(0, firstPassCap).map((e, i) => ({
    index: i,
    title: e.title.slice(0, 200),
    organization: e.organization.slice(0, 200),
    dateRange: e.dateRange.slice(0, 100),
    description: e.description.slice(0, MAX_CHARS_PER_ENTRY),
  }));
  if (entries.length > firstPassCap) {
    console.log(
      `[perf] First-pass cap: ${sectionId} has ${entries.length} entries, processing first ${firstPassCap}`
    );
  }

  const entriesJson = JSON.stringify(cappedEntries, null, 2);

  // Try per-entry prompt first, fall back to standard rewrite prompt
  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) {
    // Fall back to standard section rewrite if entry-specific prompt not found
    console.warn(`[diag] No entry-level prompt found (${promptKey}), falling back to standard rewrite`);
    return rewriteSection(
      sectionId,
      fullSectionContent,
      promptKey.replace(".entries", ""),
      targetRole,
      jobObjective,
      framing,
      locale,
      promptVersions,
      failureReasons,
      sectionDiagnostics,
      retryAttemptsByReason
    );
  }

  promptVersions[promptKey] = prompt.version;

  const systemPrompt = interpolatePrompt(prompt.content, {
    section_name: SECTION_DISPLAY_NAMES[sectionId] ?? sectionId,
    original_content: truncate(fullSectionContent, MAX_SECTION_CHARS, sectionId),
    entries_json: entriesJson,
    entry_count: String(cappedEntries.length),
    target_role: targetRole,
    job_objective: jobObjective,
    objective_mode_label: framing.objective_mode_label,
    objective_framing: framing.objective_framing,
    objective_context: framing.objective_context,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // HOTFIX-2: Explicit language instruction for non-English locales
      const langInstruction = locale !== "en"
        ? " ALL output text (original, improvements, missingSuggestions, rewritten, and all entry fields) MUST be in Spanish."
        : "";

      const userMessage =
        attempt === 0
          ? `Rewrite this ${SECTION_DISPLAY_NAMES[sectionId] ?? sectionId} section. Provide BOTH a section-level summary AND per-entry rewrites. Respond in JSON with keys: original, improvements, missingSuggestions, rewritten, entries (array of {entryTitle, original, improvements, missingSuggestions, rewritten}).${langInstruction}`
          : `Your previous response was not valid JSON. Please respond with ONLY valid JSON.${langInstruction}`;

      // HOTFIX-5 D.9: Per-rewrite 20s hard timeout via AbortController
      const rewriteController = new AbortController();
      const rewriteTimeout = setTimeout(() => rewriteController.abort(), REWRITE_CALL_TIMEOUT_MS);
      let result;
      try {
        result = await callLLM({
          model: LLM_MODEL_QUALITY,
          systemPrompt:
            attempt === 0
              ? systemPrompt
              : systemPrompt + "\n\nIMPORTANT: Respond with ONLY valid JSON.",
          userMessage,
          maxTokens: 4096,
          signal: rewriteController.signal,
        });
      } finally {
        clearTimeout(rewriteTimeout);
      }

      const jsonStr = extractJson(result.text);
      let rawEntryParsed: unknown;
      try {
        rawEntryParsed = JSON.parse(jsonStr);
      } catch {
        failureReasons.push("invalid_json");
        console.warn(`[diag] Entry rewrite JSON parse failed: section=${sectionId}, attempt=${attempt + 1}`);
        continue;
      }
      const parsed = RewriteSectionWithEntriesOutput.safeParse(rawEntryParsed);

      if (parsed.success) {
        // HOTFIX-5 B.4: Attachment integrity check — verify each rewritten entry
        // corresponds to the right original entry (prevents cross-contamination)
        let wrongAttachmentCount = 0;
        let attachmentSimilaritySum = 0;
        let attachmentFallbackApplied = 0;

        const rewriteEntries: RewriteEntry[] = (parsed.data.entries ?? []).map(
          (e, i) => {
            const originalEntry = cappedEntries[i];
            const originalText = originalEntry
              ? [originalEntry.title, originalEntry.organization, originalEntry.description].join(" ")
              : "";

            // Compute similarity between rewritten text and original entry text
            const similarity = originalText.length > 20
              ? computeInputOverlap(originalText, e.rewritten)
              : 1; // Skip check for very short entries
            attachmentSimilaritySum += similarity;

            let rewrittenText = stripNonFlagEmojis(e.rewritten);

            // If similarity is suspiciously low, the rewrite may be attached to wrong entry
            if (similarity < 0.15 && originalText.length > 50) {
              wrongAttachmentCount++;
              // Fallback: use original description instead of potentially contaminated rewrite
              if (originalEntry?.description) {
                rewrittenText = originalEntry.description;
                attachmentFallbackApplied++;
                console.warn(
                  `[guard] Attachment mismatch: section=${sectionId}, entry=${i}, ` +
                  `similarity=${similarity.toFixed(2)}, falling back to original`
                );
              }
            }

            return {
              entryIndex: i,
              entryTitle: e.entryTitle,
              // Carry forward structured fields from original parsed entries
              organization: originalEntry?.organization || undefined,
              title: originalEntry?.title || undefined,
              dateRange: originalEntry?.dateRange || undefined,
              original: e.original,
              improvements: e.improvements,
              missingSuggestions: e.missingSuggestions,
              rewritten: rewrittenText,
            };
          }
        );

        const entryCount = rewriteEntries.length;
        const attachmentSimilarityAvg = entryCount > 0
          ? attachmentSimilaritySum / entryCount
          : 1;

        if (wrongAttachmentCount > 0 || attachmentSimilarityAvg < 0.4) {
          console.warn(
            `[diag] ATTACHMENT_INTEGRITY: section=${sectionId}, ` +
            `wrongAttachmentCount=${wrongAttachmentCount}, ` +
            `attachmentSimilarityAvg=${attachmentSimilarityAvg.toFixed(2)}, ` +
            `attachmentFallbackApplied=${attachmentFallbackApplied}`
          );
        }

        // HOTFIX-9b: Append passthrough entries for any entries beyond the LLM cap
        // This ensures ALL parsed entries appear in the final output
        if (entries.length > firstPassCap) {
          const remainingEntries: RewriteEntry[] = entries.slice(firstPassCap).map((e, i) => ({
            entryIndex: firstPassCap + i,
            entryTitle: [e.title, e.organization].filter(Boolean).join(" at ") || `Entry ${firstPassCap + i + 1}`,
            organization: e.organization || undefined,
            title: e.title || undefined,
            dateRange: e.dateRange || undefined,
            original: e.description,
            improvements: "",
            missingSuggestions: getFallbackSuggestions(sectionId),
            rewritten: e.description, // passthrough: original = rewritten
          }));
          rewriteEntries.push(...remainingEntries);
          console.log(
            `[hotfix-9b] Appended ${remainingEntries.length} passthrough entries for ${sectionId} (total: ${rewriteEntries.length})`
          );
        }

        const rewrite: RewritePreview = {
          sectionId,
          source: promptKey.includes("linkedin") ? "linkedin" : "cv",
          original: parsed.data.original,
          improvements: parsed.data.improvements,
          missingSuggestions: parsed.data.missingSuggestions,
          rewritten: stripNonFlagEmojis(parsed.data.rewritten),
          locked: false,
          entries: rewriteEntries.length > 0 ? rewriteEntries : undefined,
        };

        // HOTFIX-9b: Ensure missingSuggestions is never empty (filter empty strings)
        rewrite.missingSuggestions = (rewrite.missingSuggestions ?? []).filter((s) => s.trim().length > 0);
        if (rewrite.missingSuggestions.length === 0) {
          rewrite.missingSuggestions = getFallbackSuggestions(sectionId);
        }
        // HOTFIX-9b: Ensure entry-level missingSuggestions are never empty
        if (rewrite.entries) {
          for (const entry of rewrite.entries) {
            entry.missingSuggestions = (entry.missingSuggestions ?? []).filter((s: string) => s.trim().length > 0);
            if (entry.missingSuggestions.length === 0) {
              entry.missingSuggestions = getFallbackSuggestions(sectionId);
            }
          }
        }

        if (isMockRewrite(rewrite)) {
          console.warn(
            `[guard] Mock fingerprint in entry rewrite ${sectionId} (attempt ${attempt + 1}), retrying`
          );
          failureReasons.push("mock_fingerprint_retry");
          continue;
        }

        // HOTFIX-2: Language drift detection — retry if rewrite is in wrong language
        if (locale !== "en" && attempt === 0 && !isOutputInTargetLocale(rewrite.rewritten, locale)) {
          console.warn(
            `[lang-guard] Language drift in entry rewrite ${sectionId} (attempt ${attempt + 1}), retrying`
          );
          failureReasons.push("lang_drift_retry");
          continue;
        }

        console.log(
          `[rewrite] Per-entry rewrite: section=${sectionId}, entries=${rewriteEntries.length}/${cappedEntries.length}`
        );

        return { rewrite, modelUsed: result.modelUsed };
      }

      failureReasons.push("invalid_json");
      console.warn(
        `[diag] Entry rewrite parse failed: section=${sectionId}, attempt=${attempt + 1}, error=${parsed.error?.message}`
      );
    } catch (err) {
      const reason = categorizeError(err);
      failureReasons.push(reason);
      console.warn(
        `[diag] Entry rewrite LLM error: section=${sectionId}, attempt=${attempt + 1}, reason=${reason}`
      );
    }
  }

  // Fall back to standard whole-section rewrite
  console.warn(
    `[fallback] Entry-level rewrite failed for ${sectionId}, falling back to section-level`
  );
  return rewriteSection(
    sectionId,
    fullSectionContent,
    promptKey.replace(".entries", ""),
    targetRole,
    jobObjective,
    framing,
    locale,
    promptVersions,
    failureReasons,
    sectionDiagnostics,
    retryAttemptsByReason
  );
}

// ── PERF-HOTFIX: Fast section-level rewrite (Haiku, 8s, single attempt) ──
const FAST_REWRITE_TIMEOUT_MS = 8_000;

async function fastSectionRewriteWithEntries(
  sectionId: string,
  entries: ParsedEntry[],
  fullSectionContent: string,
  promptKey: string,
  targetRole: string,
  jobObjective: string,
  framing: ObjectiveFraming,
  locale: Locale,
  promptVersions: Record<string, number>,
  failureReasons: FailureReason[],
  sectionDiagnostics: SectionDiagnostic[],
  retryAttemptsByReason: Record<string, number>
): Promise<{ rewrite: RewritePreview; modelUsed: string; mode: "fast_section" | "passthrough" }> {
  const sectionStart = Date.now();
  const source = promptKey.includes("linkedin") ? "linkedin" : "cv";
  const isCore = ["experience", "education", "headline", "about"].includes(sectionId);

  // Cap entries same as normal path
  const firstPassCap = Math.min(MAX_ENTRIES_FIRST_PASS, MAX_ENTRIES_PER_SECTION);
  const cappedEntries = entries.slice(0, firstPassCap).map((e, i) => ({
    index: i,
    title: e.title.slice(0, 200),
    organization: e.organization.slice(0, 200),
    dateRange: e.dateRange.slice(0, 100),
    description: e.description.slice(0, MAX_CHARS_PER_ENTRY),
  }));

  // Build passthrough entries for fallback
  const buildPassthrough = (): RewriteEntry[] =>
    cappedEntries.map((e, i) => ({
      entryIndex: i,
      entryTitle: [e.title, e.organization].filter(Boolean).join(" at ") || `Entry ${i + 1}`,
      organization: e.organization || undefined,
      title: e.title || undefined,
      dateRange: e.dateRange || undefined,
      original: e.description,
      improvements: "",
      missingSuggestions: getFallbackSuggestions(sectionId),
      rewritten: e.description, // pass-through: original = rewritten
    }));

  // Build passthrough RewritePreview
  const buildPassthroughPreview = (): RewritePreview => ({
    sectionId,
    source: source as "linkedin" | "cv",
    original: fullSectionContent.slice(0, 2000),
    improvements: "",
    missingSuggestions: getFallbackSuggestions(sectionId),
    rewritten: fullSectionContent.slice(0, 2000),
    locked: false,
    entries: buildPassthrough(),
  });

  // Try to get the prompt
  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) {
    console.warn(`[perf] fastRewrite: no prompt found for ${promptKey}, using passthrough`);
    return { rewrite: buildPassthroughPreview(), modelUsed: "none", mode: "passthrough" };
  }
  promptVersions[promptKey] = prompt.version;

  const entriesJson = JSON.stringify(cappedEntries, null, 2);
  const systemPrompt = interpolatePrompt(prompt.content, {
    section_name: SECTION_DISPLAY_NAMES[sectionId] ?? sectionId,
    original_content: truncate(fullSectionContent, MAX_SECTION_CHARS, sectionId),
    entries_json: entriesJson,
    entry_count: String(cappedEntries.length),
    target_role: targetRole,
    job_objective: jobObjective,
    objective_mode_label: framing.objective_mode_label,
    objective_framing: framing.objective_framing,
    objective_context: framing.objective_context,
  });

  // Single attempt, no retries
  try {
    const langInstruction = locale !== "en"
      ? " ALL output text (original, improvements, missingSuggestions, rewritten, and all entry fields) MUST be in Spanish."
      : "";

    const userMessage =
      `Rewrite this ${SECTION_DISPLAY_NAMES[sectionId] ?? sectionId} section. Provide BOTH a section-level summary AND per-entry rewrites. Respond in JSON with keys: original, improvements, missingSuggestions, rewritten, entries (array of {entryTitle, original, improvements, missingSuggestions, rewritten}).${langInstruction}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FAST_REWRITE_TIMEOUT_MS);
    let result;
    try {
      result = await callLLM({
        model: LLM_MODEL_FAST, // Haiku instead of Sonnet
        systemPrompt,
        userMessage,
        maxTokens: 4096,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const jsonStr = extractJson(result.text);
    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(jsonStr);
    } catch {
      console.warn(`[perf] fastRewrite: JSON parse failed, using passthrough`);
      failureReasons.push("invalid_json");
      return { rewrite: buildPassthroughPreview(), modelUsed: result.modelUsed, mode: "passthrough" };
    }

    const parsed = RewriteSectionWithEntriesOutput.safeParse(rawParsed);
    if (!parsed.success) {
      console.warn(`[perf] fastRewrite: schema validation failed, using passthrough`);
      failureReasons.push("invalid_json");
      return { rewrite: buildPassthroughPreview(), modelUsed: result.modelUsed, mode: "passthrough" };
    }

    // Build entries from LLM response — skip attachment integrity check (trust archetype)
    const rewriteEntries: RewriteEntry[] = (parsed.data.entries ?? []).map((e, i) => {
      const originalEntry = cappedEntries[i];
      return {
        entryIndex: i,
        entryTitle: e.entryTitle,
        organization: originalEntry?.organization || undefined,
        title: originalEntry?.title || undefined,
        dateRange: originalEntry?.dateRange || undefined,
        original: e.original,
        improvements: e.improvements,
        missingSuggestions: e.missingSuggestions,
        rewritten: stripNonFlagEmojis(e.rewritten),
      };
    });

    // HOTFIX-9b: Append passthrough entries for any entries beyond the LLM cap
    if (entries.length > firstPassCap) {
      const remainingEntries: RewriteEntry[] = entries.slice(firstPassCap).map((e, i) => ({
        entryIndex: firstPassCap + i,
        entryTitle: [e.title, e.organization].filter(Boolean).join(" at ") || `Entry ${firstPassCap + i + 1}`,
        organization: e.organization || undefined,
        title: e.title || undefined,
        dateRange: e.dateRange || undefined,
        original: e.description,
        improvements: "",
        missingSuggestions: getFallbackSuggestions(sectionId),
        rewritten: e.description,
      }));
      rewriteEntries.push(...remainingEntries);
      console.log(
        `[hotfix-9b] fastPath: Appended ${remainingEntries.length} passthrough entries for ${sectionId}`
      );
    }

    const rewrite: RewritePreview = {
      sectionId,
      source: source as "linkedin" | "cv",
      original: parsed.data.original,
      improvements: parsed.data.improvements,
      missingSuggestions: parsed.data.missingSuggestions,
      rewritten: stripNonFlagEmojis(parsed.data.rewritten),
      locked: false,
      entries: rewriteEntries.length > 0 ? rewriteEntries : undefined,
    };

    // HOTFIX-9b: Ensure missingSuggestions is never empty (filter empty strings)
    rewrite.missingSuggestions = (rewrite.missingSuggestions ?? []).filter((s) => s.trim().length > 0);
    if (rewrite.missingSuggestions.length === 0) {
      rewrite.missingSuggestions = getFallbackSuggestions(sectionId);
    }
    if (rewrite.entries) {
      for (const entry of rewrite.entries) {
        entry.missingSuggestions = (entry.missingSuggestions ?? []).filter((s: string) => s.trim().length > 0);
        if (entry.missingSuggestions.length === 0) {
          entry.missingSuggestions = getFallbackSuggestions(sectionId);
        }
      }
    }

    console.log(
      `[perf] fastRewrite: section=${sectionId}, entries=${rewriteEntries.length}/${cappedEntries.length}, ` +
      `model=${result.modelUsed}, duration=${Date.now() - sectionStart}ms`
    );

    return { rewrite, modelUsed: result.modelUsed, mode: "fast_section" };
  } catch (err) {
    const { reason } = classifyError(err);
    failureReasons.push(reason);
    retryAttemptsByReason[reason] = (retryAttemptsByReason[reason] || 0) + 1;

    const sectionReason: SectionFailureReason = reason === "timeout" ? "llm_timeout"
      : reason === "rate_limit_429" ? "llm_rate_limited"
      : "retry_exhausted";

    console.warn(
      `[perf] fastRewrite: error (${reason}), using passthrough. ` +
      `section=${sectionId}, duration=${Date.now() - sectionStart}ms, ` +
      `error=${err instanceof Error ? err.message : "Unknown"}`
    );

    sectionDiagnostics.push({
      sectionId, module: "rewrite", source, isCore, reason: sectionReason,
      attempts: 1, durationMs: Date.now() - sectionStart,
    });

    return { rewrite: buildPassthroughPreview(), modelUsed: LLM_MODEL_FAST, mode: "passthrough" };
  }
}

// ── PERF-HOTFIX-2: Fast section-level rewrite (Haiku, no entries) ──
// Mirrors rewriteSection() but: Haiku model, 8s timeout, 1 attempt, passthrough on failure.
// Used for headline/summary in first-pass when archetype is confident.
async function fastRewriteSection(
  sectionId: string,
  originalContent: string,
  promptKey: string,
  targetRole: string,
  jobObjective: string,
  framing: ObjectiveFraming,
  locale: Locale,
  promptVersions: Record<string, number>,
  failureReasons: FailureReason[],
  sectionDiagnostics: SectionDiagnostic[],
  retryAttemptsByReason: Record<string, number>
): Promise<{ rewrite: RewritePreview; modelUsed: string; mode: "fast_section" | "passthrough" }> {
  const sectionStart = Date.now();
  const source: "linkedin" | "cv" = promptKey.includes("linkedin") ? "linkedin" : "cv";
  const isCore = isCoreSection(sectionId, source);

  // Passthrough builder — returns original content as-is
  const buildPassthroughPreview = (): RewritePreview => ({
    sectionId,
    source,
    original: originalContent.slice(0, 2000),
    improvements: "",
    missingSuggestions: getFallbackSuggestions(sectionId),
    rewritten: originalContent.slice(0, 2000),
    locked: false,
  });

  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) {
    console.warn(`[perf] fastRewriteSection: no prompt for ${promptKey}, passthrough`);
    return { rewrite: buildPassthroughPreview(), modelUsed: "none", mode: "passthrough" };
  }
  promptVersions[promptKey] = prompt.version;

  const systemPrompt = interpolatePrompt(prompt.content, {
    section_name: SECTION_DISPLAY_NAMES[sectionId] ?? sectionId,
    original_content: truncate(originalContent, MAX_SECTION_CHARS, sectionId),
    target_role: targetRole,
    job_objective: jobObjective,
    objective_mode_label: framing.objective_mode_label,
    objective_framing: framing.objective_framing,
    objective_context: framing.objective_context,
  });

  // Single attempt, no retries — passthrough on any failure
  try {
    const langInstruction = locale !== "en"
      ? " ALL output text (original, improvements, missingSuggestions, rewritten) MUST be in Spanish."
      : "";

    const userMessage =
      `Rewrite this section. Respond in JSON format with keys: original, improvements, missingSuggestions, rewritten.${langInstruction}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FAST_REWRITE_TIMEOUT_MS);
    let result;
    try {
      result = await callLLM({
        model: LLM_MODEL_FAST, // Haiku instead of Sonnet
        systemPrompt,
        userMessage,
        maxTokens: 2048, // Headline/summary are small
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    // Empty output check
    if (!result.text || result.text.trim().length < 5) {
      console.warn(`[perf] fastRewriteSection: empty output for ${sectionId}, passthrough`);
      failureReasons.push("invalid_json");
      return { rewrite: buildPassthroughPreview(), modelUsed: result.modelUsed, mode: "passthrough" };
    }

    const jsonStr = extractJson(result.text);
    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(jsonStr);
    } catch {
      console.warn(`[perf] fastRewriteSection: JSON parse failed for ${sectionId}, passthrough`);
      failureReasons.push("invalid_json");
      return { rewrite: buildPassthroughPreview(), modelUsed: result.modelUsed, mode: "passthrough" };
    }

    const parsed = RewriteSectionOutput.safeParse(rawParsed);
    if (!parsed.success) {
      console.warn(`[perf] fastRewriteSection: schema invalid for ${sectionId}, passthrough`);
      failureReasons.push("invalid_json");
      return { rewrite: buildPassthroughPreview(), modelUsed: result.modelUsed, mode: "passthrough" };
    }

    const rewrite: RewritePreview = {
      sectionId,
      source,
      original: parsed.data.original,
      improvements: parsed.data.improvements,
      missingSuggestions: parsed.data.missingSuggestions,
      rewritten: stripNonFlagEmojis(parsed.data.rewritten),
      locked: false,
    };

    // HOTFIX-9b: Ensure missingSuggestions is never empty (filter empty strings)
    rewrite.missingSuggestions = (rewrite.missingSuggestions ?? []).filter((s) => s.trim().length > 0);
    if (rewrite.missingSuggestions.length === 0) {
      rewrite.missingSuggestions = getFallbackSuggestions(sectionId);
    }

    // Anti-placeholder guard (same as rewriteSection)
    if (isMockRewrite(rewrite)) {
      console.warn(`[perf] fastRewriteSection: mock fingerprint in ${sectionId}, passthrough`);
      failureReasons.push("mock_fingerprint_retry");
      return { rewrite: buildPassthroughPreview(), modelUsed: result.modelUsed, mode: "passthrough" };
    }

    console.log(
      `[perf] fastRewriteSection: section=${sectionId}, model=${result.modelUsed}, ` +
      `duration=${Date.now() - sectionStart}ms`
    );

    return { rewrite, modelUsed: result.modelUsed, mode: "fast_section" };
  } catch (err) {
    const { reason } = classifyError(err);
    failureReasons.push(reason);
    retryAttemptsByReason[reason] = (retryAttemptsByReason[reason] || 0) + 1;

    const sectionReason: SectionFailureReason = reason === "timeout" ? "llm_timeout"
      : reason === "rate_limit_429" ? "llm_rate_limited"
      : "retry_exhausted";

    console.warn(
      `[perf] fastRewriteSection: error (${reason}), passthrough. ` +
      `section=${sectionId}, duration=${Date.now() - sectionStart}ms, ` +
      `error=${err instanceof Error ? err.message : "Unknown"}`
    );

    sectionDiagnostics.push({
      sectionId, module: "rewrite", source, isCore, reason: sectionReason,
      attempts: 1, durationMs: Date.now() - sectionStart,
    });

    return { rewrite: buildPassthroughPreview(), modelUsed: LLM_MODEL_FAST, mode: "passthrough" };
  }
}

// ── Generate cover letter via LLM ───────────────────────
async function generateCoverLetter(
  targetRole: string,
  jobObjective: string,
  keyStrengths: string,
  overallScore: number,
  framing: ObjectiveFraming,
  locale: Locale,
  promptVersions: Record<string, number>,
  failureReasons: FailureReason[]
): Promise<{ coverLetter: CoverLetterResult; modelUsed: string } | null> {
  const prompt = await getActivePromptWithVersion(
    "export.cover-letter.system",
    locale
  );
  if (!prompt) {
    failureReasons.push("missing_prompt");
    console.error(`[diag] Missing prompt: key=export.cover-letter.system, locale=${locale}`);
    return null;
  }

  promptVersions["export.cover-letter.system"] = prompt.version;

  const systemPrompt = interpolatePrompt(prompt.content, {
    target_role: targetRole,
    job_objective: jobObjective,
    key_strengths: keyStrengths,
    overall_score: String(overallScore),
    objective_mode_label: framing.objective_mode_label,
    objective_framing: framing.objective_framing,
    objective_context: framing.objective_context,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const userMessage =
        attempt === 0
          ? "Generate the cover letter. Respond in JSON format with a single key: content (the full cover letter text)."
          : "Your previous response was not valid JSON. Please respond with ONLY a valid JSON object with key: content.";

      const result = await callLLM({
        model: LLM_MODEL_QUALITY,
        systemPrompt: attempt === 0 ? systemPrompt : systemPrompt + "\n\nIMPORTANT: Respond with ONLY valid JSON.",
        userMessage,
        maxTokens: 4096,
      });

      const jsonStr = extractJson(result.text);
      let rawCLParsed: unknown;
      try {
        rawCLParsed = JSON.parse(jsonStr);
      } catch {
        failureReasons.push("invalid_json");
        console.warn(`[diag] Cover letter JSON parse failed: attempt=${attempt + 1}`);
        continue;
      }
      const parsed = CoverLetterOutput.safeParse(rawCLParsed);

      if (parsed.success) {
        // ── Anti-placeholder guard for cover letter ──
        if (isPlaceholderContent(parsed.data.content)) {
          console.warn(
            `[guard] Mock fingerprint detected in cover letter (attempt ${attempt + 1}), retrying`
          );
          failureReasons.push("mock_fingerprint_retry");
          continue;
        }

        return {
          coverLetter: {
            content: parsed.data.content,
            locked: false,
          },
          modelUsed: result.modelUsed,
        };
      }
    } catch (err) {
      const reason = categorizeError(err);
      failureReasons.push(reason);
      console.warn(
        `[diag] Cover letter error: attempt=${attempt + 1}, reason=${reason}, error=${err instanceof Error ? err.message : "Unknown"}`
      );
    }
  }

  return null;
}

// ── Generate overall descriptor via LLM ─────────────────
async function generateOverallDescriptor(
  sections: ScoreSection[],
  overallScore: number,
  overallTier: ScoreTier,
  headlineExplanation: string,
  framing: ObjectiveFraming,
  locale: Locale,
  promptVersions: Record<string, number>,
  failureReasons: FailureReason[]
): Promise<string | undefined> {
  const prompt = await getActivePromptWithVersion(
    "audit.overall-descriptor.system",
    locale
  );
  if (!prompt) {
    console.warn("[diag] Missing prompt: audit.overall-descriptor.system — skipping descriptor generation");
    return undefined;
  }

  promptVersions["audit.overall-descriptor.system"] = prompt.version;

  // Build section summary for interpolation
  const sectionSummaries = sections
    .slice(0, 8)
    .map(
      (s) =>
        `${SECTION_DISPLAY_NAMES[s.id] ?? s.id}: ${s.score}/100 (${s.tier}) — ${s.explanation.slice(0, 120)}`
    )
    .join("\n");

  const systemPrompt = interpolatePrompt(prompt.content, {
    overall_score: String(overallScore),
    overall_tier: overallTier,
    section_summaries: sectionSummaries,
    objective_mode_label: framing.objective_mode_label,
    objective_context: framing.objective_context,
    objective_framing: framing.objective_framing,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const antiRepeat =
        attempt === 1
          ? `\n\nCRITICAL: Do NOT repeat or paraphrase this text: "${headlineExplanation.slice(0, 200)}"`
          : "";

      const result = await callLLM({
        model: LLM_MODEL_FAST,
        systemPrompt: systemPrompt + antiRepeat,
        userMessage:
          attempt === 0
            ? "Generate the overall profile descriptor. Respond in JSON with key: descriptor."
            : "Your previous response was a duplicate. Generate a UNIQUE descriptor. Respond with ONLY valid JSON with key: descriptor.",
      });

      const jsonStr = extractJson(result.text);
      let jsonObj: unknown;
      try {
        jsonObj = JSON.parse(jsonStr);
      } catch {
        console.warn(
          `[diag] Overall descriptor JSON parse failed: attempt=${attempt + 1}, raw=${result.text.slice(0, 200)}`
        );
        continue;
      }
      const parsed = OverallDescriptorOutput.safeParse(jsonObj);

      if (!parsed.success) {
        console.warn(
          `[diag] Overall descriptor Zod validation failed: attempt=${attempt + 1}, errors=${JSON.stringify(parsed.error.issues)}, raw=${JSON.stringify(jsonObj).slice(0, 200)}`
        );
      }

      if (parsed.success) {
        const descriptor = stripNonFlagEmojis(parsed.data.descriptor);

        // Anti-duplication guard: check against headline explanation
        if (
          headlineExplanation &&
          isOverallDescriptorDuplicate(descriptor, headlineExplanation)
        ) {
          console.warn(
            `[guard] Overall descriptor duplicates headline explanation (attempt ${attempt + 1}), retrying`
          );
          continue; // Force retry with anti-repeat instruction
        }

        return descriptor;
      }
    } catch (err) {
      const reason = categorizeError(err);
      failureReasons.push(reason);
      console.warn(
        `[diag] Overall descriptor error: attempt=${attempt + 1}, reason=${reason}`
      );
    }
  }

  return undefined; // Graceful degradation: page falls back to headline explanation
}

// ── Plan-based locking logic ────────────────────────────
// Imported from unlock-matrix.ts (single source of truth)

// ── Parse CV text into sections ─────────────────────────
function parseCvSections(cvText: string): Record<string, string> {
  // Similar to LinkedIn parser but for CV format
  const sections: Record<string, string> = {};
  const lines = cvText.split("\n");

  // HOTFIX-3: Relaxed prefix matching (like LinkedIn parser) + Spanish patterns + broader fallbacks
  const cvHeaders: { pattern: RegExp; id: string }[] = [
    { pattern: /^contact\s*(info|information|details)?(\s|$)/i, id: "contact-info" },
    { pattern: /^(datos\s+(personales|de\s+contacto))(\s|$)/i, id: "contact-info" },
    {
      pattern: /^(professional\s+)?summary|profile(\s+summary)?|objective(\s|$)/i,
      id: "professional-summary",
    },
    { pattern: /^(perfil|resumen)\s*(profesional)?(\s|$)/i, id: "professional-summary" },
    {
      pattern: /^(work\s+)?experience|employment(\s+history)?(\s|$)/i,
      id: "work-experience",
    },
    { pattern: /^experiencia\s*(laboral|profesional)?(\s|$)/i, id: "work-experience" },
    { pattern: /^(technical\s+)?skills|competenc(ies|ias)(\s|$)/i, id: "skills-section" },
    { pattern: /^(habilidades|aptitudes)(\s|$)/i, id: "skills-section" },
    { pattern: /^education(\s|$)/i, id: "education-section" },
    { pattern: /^(educación|formación)(\s+académica)?(\s|$)/i, id: "education-section" },
    {
      pattern: /^certifications?|licenses?\s*(&|and)?\s*certifications?|awards?|honors?(\s|$)/i,
      id: "certifications",
    },
  ];

  let currentSection: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    if (currentSection && currentLines.length > 0) {
      const content = currentLines.join("\n").trim();
      if (content) sections[currentSection] = content;
    }
    currentLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    let matched = false;
    for (const { pattern, id } of cvHeaders) {
      if (pattern.test(trimmed)) {
        flush();
        currentSection = id;
        matched = true;
        break;
      }
    }
    if (!matched && currentSection) {
      currentLines.push(line);
    }
  }
  flush();

  // HOTFIX-3: Fallback — if no `work-experience` found, look for a generic "EXPERIENCE" line
  if (!sections["work-experience"] && cvText.trim().length > 0) {
    const expIdx = lines.findIndex((l) => /^experience(\s|$)/i.test(l.trim()));
    if (expIdx >= 0) {
      // Collect lines from "EXPERIENCE" until the next known section header
      const expLines: string[] = [];
      for (let i = expIdx + 1; i < lines.length; i++) {
        let isHeader = false;
        for (const { pattern } of cvHeaders) {
          if (pattern.test(lines[i].trim())) { isHeader = true; break; }
        }
        if (isHeader) break;
        expLines.push(lines[i]);
      }
      const content = expLines.join("\n").trim();
      if (content.length > 20) {
        sections["work-experience"] = content;
        console.log(`[diag] CV parser fallback: mapped generic "EXPERIENCE" header to work-experience (${content.length} chars)`);
      }
    }
  }

  // If no sections were parsed, treat the whole text as professional-summary
  if (Object.keys(sections).length === 0 && cvText.trim().length > 0) {
    sections["professional-summary"] = truncate(cvText.trim());
  }

  return sections;
}

/**
 * HOTFIX-8: Fallback regex extractor for contact info when header is missing.
 * Scans the first 20 lines for email, phone, LinkedIn URL patterns.
 * Returns concatenated matches or null if nothing found.
 *
 * HOTFIX-9: Enhanced to extract full LinkedIn URLs from embedded link targets
 * (e.g., PDF hyperlink text) and filter bare "LinkedIn" text without a URL.
 */
function extractContactInfoFallback(text: string): string | null {
  const allLines = text.split("\n");
  const headerLines = allLines.slice(0, 20);
  const contactLines: string[] = [];

  const EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w{2,}/;
  const PHONE_RE = /(\+?\d[\d\s\-().]{7,}\d)/;
  const LINKEDIN_RE = /linkedin\.com\/in\/[\w-]+/i;
  const LOCATION_RE = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2}\s*\d{0,5}/;

  // HOTFIX-9: Full URL pattern to extract embedded LinkedIn URLs
  const LINKEDIN_URL_RE = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+/i;
  // HOTFIX-9: Detect bare "LinkedIn" text without actual URL
  const BARE_LINKEDIN_RE = /^\s*linkedin\s*$/i;

  // HOTFIX-9c: Scan ALL lines for annotation-sourced LinkedIn URLs
  // pdf-extract.ts appends "LinkedIn: https://linkedin.com/in/..." at the end
  // These are the REAL hyperlink targets from PDF annotations, which are more
  // reliable than the garbled display text in the PDF text layer.
  const ANNOTATION_MARKER_RE = /^LinkedIn:\s*(https?:\/\/(?:www\.)?linkedin\.com\/in\/[\w-]+)/i;
  let annotationLinkedinUrl: string | null = null;
  for (let i = allLines.length - 1; i >= Math.max(0, allLines.length - 10); i--) {
    const match = allLines[i].trim().match(ANNOTATION_MARKER_RE);
    if (match) {
      annotationLinkedinUrl = match[1];
      break;
    }
  }

  let grabbedFirstLine = false;
  let hasLinkedinInHeader = false;

  for (const line of headerLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // HOTFIX-9: Skip bare "LinkedIn" text without actual URL
    if (BARE_LINKEDIN_RE.test(trimmed)) continue;

    // HOTFIX-9: Extract full LinkedIn URL from embedded patterns
    // PDF parsers may render links as "(link)" or "[link]" or bare URLs
    const linkedinUrlMatch = trimmed.match(LINKEDIN_URL_RE);
    if (linkedinUrlMatch && !LINKEDIN_RE.test(trimmed.replace(linkedinUrlMatch[0], ""))) {
      // HOTFIX-9c: If we have an annotation URL, prefer it over the text-layer URL
      if (annotationLinkedinUrl) {
        contactLines.push(annotationLinkedinUrl);
        hasLinkedinInHeader = true;
      } else {
        contactLines.push(linkedinUrlMatch[0]);
        hasLinkedinInHeader = true;
      }
      continue;
    }

    // HOTFIX-9c: If line mentions LinkedIn but only has a garbled/partial URL,
    // substitute with annotation-sourced URL if available
    if (LINKEDIN_RE.test(trimmed) && annotationLinkedinUrl) {
      contactLines.push(annotationLinkedinUrl);
      hasLinkedinInHeader = true;
      continue;
    }

    if (
      EMAIL_RE.test(trimmed) ||
      PHONE_RE.test(trimmed) ||
      LINKEDIN_RE.test(trimmed) ||
      LOCATION_RE.test(trimmed)
    ) {
      if (LINKEDIN_RE.test(trimmed)) hasLinkedinInHeader = true;
      contactLines.push(trimmed);
    }
    // Grab the very first non-empty line as potential name
    if (
      !grabbedFirstLine &&
      trimmed.length > 2 &&
      trimmed.length < 60 &&
      !/^(contact|experience|education|skills|summary|objective|professional\s*goal|career)/i.test(trimmed)
    ) {
      grabbedFirstLine = true;
      if (!contactLines.includes(trimmed)) {
        contactLines.unshift(trimmed);
      }
    }
  }

  // HOTFIX-9c: If no LinkedIn URL was found in header but we have annotation URL, append it
  if (!hasLinkedinInHeader && annotationLinkedinUrl) {
    contactLines.push(annotationLinkedinUrl);
  }

  return contactLines.length >= 2 ? contactLines.join("\n") : null;
}

// ── Main orchestrator ───────────────────────────────────
export async function generateAuditResults(
  input: AuditInput,
  locale: Locale = "en",
  appLocale: Locale = "en",
  onProgress?: ProgressCallback
): Promise<GenerationResult> {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  const promptVersions: Record<string, number> = {};
  const failureReasons: FailureReason[] = [];
  // HOTFIX-4: Reset truncation tracking
  _truncationLog = [];
  let fallbackCount = 0;
  let mockLeaksDetected = 0;
  let primaryModel = LLM_MODEL_FAST;

  // PR2C: per-section diagnostics + retry tracking
  const sectionDiagnostics: SectionDiagnostic[] = [];
  const retryAttemptsByReason: Record<string, number> = {};
  let totalLLMTimeMs = 0;

  // Sprint 2: Stage timing + progress tracking
  const stageTimer = new StageTimer();
  let llmCallCount = 0;
  let sectionsSkipped = 0;
  let firstProgressMs = 0;
  let firstSectionMs = 0;
  let completedSectionCount = 0;
  let totalSectionCount = 0;

  const emitProgress = (stage: ProgressStage, percent: number, label?: string, sectionReady?: ProgressEvent["sectionReady"]) => {
    if (!onProgress || !ENABLE_PROGRESSIVE_GENERATION) return;
    if (firstProgressMs === 0) firstProgressMs = Date.now();
    if (sectionReady && firstSectionMs === 0) firstSectionMs = Date.now();
    // Sprint 2.1: Log individual sectionReady timestamps for incremental delivery verification
    if (sectionReady) {
      const elapsed = Date.now() - startTime;
      console.log(
        `[stream] request=${requestId} | sectionReady=${sectionReady.section.id} ` +
        `at=${elapsed}ms | ${completedSectionCount}/${totalSectionCount}`
      );
    }
    onProgress({
      stage,
      percent,
      label,
      sectionReady,
      completedSections: completedSectionCount,
      totalSections: totalSectionCount,
    });
  };

  const targetRole = getTargetRole(input);
  const jobObjective =
    input.objectiveMode === "job"
      ? input.jobDescription
      : input.objectiveText;
  const framing = getObjectiveFraming(input);

  // P0-1: Request-level diagnostics header
  console.log(
    `[diag] request=${requestId} | ` +
    `linkedinLen=${input.linkedinText.length} | ` +
    `cvLen=${(input.cvText ?? "").length} | ` +
    `jobLen=${input.jobDescription.length} | ` +
    `objective=${input.objectiveMode} | ` +
    `plan=${input.planId} | ` +
    `forceFresh=${input.forceFresh ?? false}`
  );
  console.log(
    `[diag] request=${requestId} | ` +
    `auditModel=${LLM_MODEL_FAST} | rewriteModel=${LLM_MODEL_QUALITY} | ` +
    `locale=${locale} | appLocale=${appLocale}`
  );

  // P0-3: Verify LLM env vars are set (detect trailing newline issues)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() !== apiKey) {
    console.error(`[diag] ANTHROPIC_API_KEY issue: set=${!!apiKey}, hasWhitespace=${apiKey ? apiKey.trim() !== apiKey : false}`);
  }

  // Sprint 2: Stage progress emissions
  stageTimer.start("cache_check");
  emitProgress("cache_check", 0, "Checking cache...");

  // ─── 0. Check DB cache ────────────────────────────────
  // P0-4: skip cache when forceFresh is set
  if (input.forceFresh) {
    console.log(`[diag] request=${requestId} | forceFresh=true, skipping cache`);
  }
  try {
    const inputHash = await computeInputHash({
      linkedinText: input.linkedinText,
      cvText: input.cvText,
      jobDescription: input.jobDescription,
      locale,
      objectiveMode: input.objectiveMode,
      objectiveText: input.objectiveText,
    });

    const cached = input.forceFresh ? null : await getCachedResult(inputHash);
    if (cached) {
      // ── Guard: reject cached results that contain mock fingerprints ──
      const cachedHasMock = [
        ...cached.results.linkedinSections,
        ...cached.results.cvSections,
      ].some(isMockSection);

      if (!cachedHasMock) {
        const durationMs = Date.now() - startTime;
        console.log(`Audit served from cache: ${durationMs}ms`);

        // Re-apply plan locking to cached results (plan may differ)
        const results = applyPlanLocking(cached.results, input);

        return {
          results,
          meta: {
            modelUsed: cached.modelUsed,
            promptVersionsUsed: cached.promptVersions,
            durationMs,
            fallbackCount: 0,
            hasFallback: false,
            sectionCountGenerated: results.linkedinSections.length + results.cvSections.length,
            mockLeaksDetected: 0,
            degraded: false,
            failureReasons: [],
            normalizedSuggestionsCount: 0,
            invalidJsonTooBigCount: 0,
            retryTooBigSuccessCount: 0,
            sectionDiagnostics: [],
            coreFailureCount: 0,
            nonCoreFailureCount: 0,
            fallbackReasonDistribution: {},
            retryAttemptsByReason: {},
            totalLLMTimeMs: 0,
            preflightResult: { passed: true, missing: [] },
            structuringUsed: false,
            structuringDurationMs: 0,
            repetitiveEntryCount: 0,
            hallucinatedMetricCount: 0,
            entryScoringSectionCount: 0,
            entryScoringSuccessCount: 0,
            entryScoringFailCount: 0,
            entryScoringDurationMs: 0,
          },
        };
      } else {
        console.warn("[guard] Cached result contains mock fingerprints, invalidating and regenerating");
        // Don't serve stale mock-contaminated cache — fall through to fresh generation
      }
    }
  } catch {
    // Cache errors should never block generation
  }

  // ─── 1a. Prompt readiness preflight ──────────────────
  // Verify required prompt keys are active before spending LLM budget.
  const hasLinkedinInput = input.linkedinText.trim().length > 0;
  const hasCvInput = (input.cvText ?? "").trim().length > 20;

  const requiredPromptKeys: string[] = [];
  if (hasLinkedinInput) {
    requiredPromptKeys.push("audit.linkedin.system", "rewrite.linkedin.section");
  }
  if (hasCvInput) {
    requiredPromptKeys.push("audit.cv.system", "rewrite.cv.section");
  }

  const preflightMissing: string[] = [];
  for (const key of requiredPromptKeys) {
    const prompt = await getActivePromptWithVersion(key, locale);
    if (!prompt) preflightMissing.push(key);
  }

  const preflightResult = {
    passed: preflightMissing.length === 0,
    missing: preflightMissing,
  };

  if (!preflightResult.passed) {
    console.error(
      `[diag] request=${requestId} | PREFLIGHT FAIL: missing prompts=[${preflightMissing.join(", ")}]`
    );
  }

  stageTimer.end();
  stageTimer.start("extracting_input");
  emitProgress("extracting_input", 5, "Reading your profile...");

  // ─── 1b. Parse input sections (with conditional structuring pass) ──
  const wantStructuring = ENABLE_STRUCTURING_PASS && !!input.isPdfSource;
  let structuringUsed = false;
  let structuringDurationMs = 0;
  let structuringSkippedReason: string | undefined;

  let linkedinSections: Record<string, string> = {};
  if (input.linkedinText.trim()) {
    if (wantStructuring) {
      // PERF-HOTFIX-2: Phase 1 — regex-only parse first (~0ms)
      const regexResult = await parseLinkedinWithStructuring(
        input.linkedinText,
        locale,
        false // regex only
      );

      // Phase 2 — check if archetype is confident on regex-extracted experience
      const regexExpText = regexResult.sections["experience"] ?? "";
      let archetypeHighOnRegex = false;
      if (regexExpText.length > 50) {
        const quickArchetype = parseLinkedinExperienceArchetype(regexExpText, requestId);
        archetypeHighOnRegex =
          quickArchetype.confidence === "high" &&
          quickArchetype.entries.length > 0;
      }

      const hasHeadline = !!(regexResult.sections["headline"]?.trim());
      const hasExperience = !!(regexResult.sections["experience"]?.trim());
      const coreSectionsPresent = hasHeadline && hasExperience;

      if (archetypeHighOnRegex && coreSectionsPresent) {
        // Skip LLM structuring — regex + archetype are sufficient
        linkedinSections = regexResult.sections;
        structuringSkippedReason = "archetype_high_confidence";
        console.log(
          `[perf] request=${requestId} | Structuring SKIPPED: ${structuringSkippedReason} ` +
          `(headline=${hasHeadline}, exp=${hasExperience})`
        );
      } else {
        // Fall back to full LLM structuring
        const fullResult = await parseLinkedinWithStructuring(
          input.linkedinText,
          locale,
          true
        );
        linkedinSections = fullResult.sections;
        structuringUsed = fullResult.structuringUsed;
        structuringDurationMs = fullResult.structuringDurationMs;
      }
    } else {
      const parseResult = await parseLinkedinWithStructuring(
        input.linkedinText,
        locale,
        false
      );
      linkedinSections = parseResult.sections;
    }
  }

  const cvSections =
    input.cvText && input.cvText.trim().length > 20
      ? parseCvSections(input.cvText)
      : {};

  // HOTFIX-8: Fallback contact-info extractor for CV
  if (!cvSections["contact-info"] && input.cvText && input.cvText.trim().length > 20) {
    const contactFallback = extractContactInfoFallback(input.cvText);
    if (contactFallback) {
      cvSections["contact-info"] = contactFallback;
      console.log(
        `[diag] request=${requestId} | HOTFIX-8: contact-info recovered via fallback regex (${contactFallback.length} chars)`
      );
    }
  }

  // ─── 1c. Heuristic language detection ──────────────────
  const combinedText = [
    input.linkedinText,
    input.cvText ?? "",
  ].join("\n");
  const langResult = detectProfileLanguage(combinedText);

  // Diagnostic: log which sections were parsed from raw input
  const parsedLinkedinIds = Object.keys(linkedinSections);
  const parsedCvIds = Object.keys(cvSections);
  const missingLinkedin = LINKEDIN_SECTION_IDS.filter(
    (id) => !linkedinSections[id]
  );
  console.log(
    `[diag] request=${requestId} | PARSE: ` +
    `linkedin_input=${input.linkedinText.trim().length}chars, ` +
    `parsed=[${parsedLinkedinIds.join(", ")}], ` +
    `missing=[${missingLinkedin.join(", ")}] | ` +
    `cv_input=${(input.cvText ?? "").trim().length}chars, ` +
    `cv_parsed=[${parsedCvIds.join(", ")}] | ` +
    `structuring=${structuringUsed} (${structuringDurationMs}ms) | ` +
    `lang=${langResult.language} (conf=${langResult.confidence.toFixed(2)})`
  );

  // HOTFIX-3 + HOTFIX-4: Enhanced parse-stage diagnostics
  {
    const linkedinChars = Object.values(linkedinSections).reduce((sum, s) => sum + s.length, 0);
    const cvChars = Object.values(cvSections).reduce((sum, s) => sum + s.length, 0);

    // HOTFIX-3B: Enhanced section-level counts
    const skillsText = linkedinSections["skills"] ?? "";
    const parsedSkillsCount = skillsText ? skillsText.split(/[\n,;·•]+/).filter((s) => s.trim().length > 1).length : 0;
    const certsText = linkedinSections["certifications"] ?? "";
    const parsedCertCount = certsText ? certsText.split(/[\n]+/).filter((s) => s.trim().length > 1).length : 0;

    // HOTFIX-3B: Education entry counts (extracted = from raw text, parsed = from parser)
    const liEduText = linkedinSections["education"] ?? "";
    const parsedLiEduEntries = liEduText ? parseEntriesFromSection("education", liEduText).entries.length : 0;
    const cvEduText = cvSections["education-section"] ?? "";
    const parsedCvEduEntries = cvEduText ? parseEntriesFromSection("education-section", cvEduText).entries.length : 0;

    // HOTFIX-3B: Identify dropped sections — only flag truly absent ones
    // Use broader keyword matching but be more accurate
    const droppedLinkedin = hasLinkedinInput
      ? LINKEDIN_SECTION_IDS.filter((id) => !linkedinSections[id] && input.linkedinText.toLowerCase().includes(id))
      : [];
    const droppedCv = hasCvInput
      ? CV_SECTION_IDS.filter((id) => !cvSections[id] && (input.cvText ?? "").toLowerCase().includes(id.replace("-section", "").replace("-info", "")))
      : [];
    const droppedSections = [...droppedLinkedin.map((id) => `linkedin.${id}`), ...droppedCv.map((id) => `cv.${id}`)];

    // HOTFIX-4: Truncation summary
    const truncationApplied = _truncationLog.length > 0;
    const truncatedChars = _truncationLog.reduce((sum, t) => sum + (t.originalChars - t.keptChars), 0);

    console.log(
      `[diag] request=${requestId} | PARSE_DETAIL: ` +
      `linkedin: extractedChars=${input.linkedinText.trim().length}, parsedChars=${linkedinChars}, sectionsKept=${parsedLinkedinIds.length}, ` +
      `parsedSkillsCount=${parsedSkillsCount}, parsedCertCount=${parsedCertCount}, parsedEducationEntries=${parsedLiEduEntries} | ` +
      `cv: extractedChars=${(input.cvText ?? "").trim().length}, parsedChars=${cvChars}, sectionsKept=${parsedCvIds.length}, ` +
      `parsedCvEducationEntries=${parsedCvEduEntries} | ` +
      `droppedSections=[${droppedSections.join(",")}] | ` +
      `truncationApplied=${truncationApplied}, truncatedChars=${truncatedChars}`
    );
    // Log per-section char counts for debugging content loss
    for (const [id, content] of Object.entries(linkedinSections)) {
      const entryCount = id === "experience"
        ? parseLinkedinExperienceArchetype(content, requestId).entries.length
        : id === "education"
          ? parseEntriesFromSection(id, content).entries.length
          : 0;
      console.log(`[diag] request=${requestId} | SECTION linkedin.${id}: ${content.length}chars, entries=${entryCount}`);
    }
    for (const [id, content] of Object.entries(cvSections)) {
      const entryCount = (id === "work-experience" || id === "education-section")
        ? parseEntriesFromSection(id, content).entries.length : 0;
      console.log(`[diag] request=${requestId} | SECTION cv.${id}: ${content.length}chars, entries=${entryCount}`);
    }
    // HOTFIX-4: Per-section truncation detail
    if (truncationApplied) {
      for (const t of _truncationLog) {
        console.log(`[diag] request=${requestId} | TRUNCATION: ${t.sectionId}: ${t.originalChars} → ${t.keptChars} (dropped ${t.originalChars - t.keptChars})`);
      }
    }
  }

  stageTimer.end();
  stageTimer.start("auditing_sections");

  // Compute total expected sections (for progress tracking)
  const linkedinSectionIds = hasLinkedinInput ? LINKEDIN_SECTION_IDS.filter((id) => !!linkedinSections[id]) : [];
  const cvSectionIds = hasCvInput ? CV_SECTION_IDS.filter((id) => !!cvSections[id]) : [];
  const skippedLinkedinCount = hasLinkedinInput ? LINKEDIN_SECTION_IDS.length - linkedinSectionIds.length : 0;
  const skippedCvCount = hasCvInput ? CV_SECTION_IDS.length - cvSectionIds.length : 0;
  sectionsSkipped = skippedLinkedinCount + skippedCvCount;
  totalSectionCount = linkedinSectionIds.length + cvSectionIds.length;
  emitProgress("auditing_sections", 15, "Scoring your sections...");

  if (sectionsSkipped > 0) {
    console.log(
      `[diag] request=${requestId} | SKIP_EMPTY: ${sectionsSkipped} empty sections skipped (linkedin=${skippedLinkedinCount}, cv=${skippedCvCount})`
    );
  }

  // ─── 2. Score LinkedIn sections (parallel) ────────────
  // Sprint 2: Only score sections that have actual content (skip empty/missing)
  // HOTFIX-2: scoreSection uses appLocale so scoring comments are in the app UI language
  const linkedinScorePromises = linkedinSectionIds.map(
    (id) => {
      llmCallCount++;
      return scoreSection(
        id,
        linkedinSections[id],
        "audit.linkedin.system",
        targetRole,
        framing,
        appLocale,
        promptVersions,
        failureReasons,
        sectionDiagnostics,
        retryAttemptsByReason
      ).then((result) => ({ id, result }));
    }
  );

  // ─── 3. Score CV sections (parallel) ──────────────────
  // Sprint 2: Only score sections that have actual content
  // HOTFIX-2: scoreSection uses appLocale so scoring comments are in the app UI language
  const cvScorePromises = cvSectionIds.map(
    (id) => {
      llmCallCount++;
      return scoreSection(
        id,
        cvSections[id],
        "audit.cv.system",
        targetRole,
        framing,
        appLocale,
        promptVersions,
        failureReasons,
        sectionDiagnostics,
        retryAttemptsByReason
      ).then((result) => ({ id, result }));
    }
  );

  const allScoreResults = await Promise.allSettled([
    ...linkedinScorePromises,
    ...cvScorePromises,
  ]);

  // ─── 4. Build scored sections — PR2C: NO mock fallback ──
  // Failed sections are omitted entirely instead of injecting mock data.
  // The UI handles missing sections gracefully, and the degraded gate
  // (hasFallback + degraded flag) protects the Rewrite Studio UX.
  const scoredLinkedinSections: ScoreSection[] = [];
  const scoredCvSections: ScoreSection[] = [];

  for (const settled of allScoreResults) {
    if (settled.status === "fulfilled" && settled.value.result) {
      const section = settled.value.result.section;
      primaryModel = settled.value.result.modelUsed;
      if (section.source === "linkedin") {
        scoredLinkedinSections.push(section);
      } else {
        scoredCvSections.push(section);
      }
    } else {
      // PR2C: No mock injection — just count the failure and skip
      fallbackCount++;
      const id =
        settled.status === "fulfilled" ? settled.value.id : "unknown";
      console.warn(`[fallback] Skipping section (no mock): ${id}`);
      // HOTFIX-8: Never drop contact-info — keep raw text as score placeholder
      if (id === "contact-info" && cvSections["contact-info"]) {
        scoredCvSections.push({
          id: "contact-info",
          source: "cv",
          score: 50,
          maxScore: 100,
          tier: "fair",
          locked: false,
          explanation: "Auto-retained from parsed CV",
          improvementSuggestions: [],
        });
        console.log(
          `[diag] request=${requestId} | HOTFIX-8: contact-info auto-retained after scoring failure`
        );
      }
    }
  }

  // ─── 4b. Section completeness check + auto-retrigger ──
  const completeness = validateSectionCompleteness(
    hasLinkedinInput,
    hasCvInput,
    scoredLinkedinSections,
    scoredCvSections,
    LINKEDIN_SECTION_IDS,
    CV_SECTION_IDS
  );

  if (completeness.autoRetrigger) {
    console.warn(
      `[guard] Section count critically low (${scoredLinkedinSections.length + scoredCvSections.length}` +
      ` of expected ${(hasLinkedinInput ? LINKEDIN_SECTION_IDS.length : 0) + (hasCvInput ? CV_SECTION_IDS.length : 0)}). ` +
      `Missing LinkedIn: [${completeness.linkedinMissing.join(", ")}], CV: [${completeness.cvMissing.join(", ")}]`
    );
    // Note: We don't auto-retry the full pipeline to avoid double-cost.
    // The zero-mock policy means gaps are simply omitted. This log helps diagnose issues.
  }

  // ─── 4b2. Core vs non-core failure analysis ──
  // Count failures by importance class from sectionDiagnostics (score module only)
  const scoreDiagnostics = sectionDiagnostics.filter((d) => d.module === "score");
  const coreScoreFailures = scoreDiagnostics.filter((d) => d.isCore);
  const nonCoreScoreFailures = scoreDiagnostics.filter((d) => !d.isCore);

  if (coreScoreFailures.length > 0) {
    console.error(
      `[diag] CORE SECTION FAILURES (${coreScoreFailures.length}): ` +
      coreScoreFailures.map((d) => `${d.sectionId}:${d.reason}`).join(", ")
    );
  }
  if (nonCoreScoreFailures.length > 0) {
    console.warn(
      `[diag] Non-core section failures (${nonCoreScoreFailures.length}): ` +
      nonCoreScoreFailures.map((d) => `${d.sectionId}:${d.reason}`).join(", ")
    );
  }

  // ─── 4c. Parse per-entry structure for experience/education ──
  const linkedinEntries: Record<string, ParsedEntry[]> = {};
  let linkedinExpAiStructured = false;
  let linkedinExpStructurerSkipped = false;
  let linkedinExpPreNormalized = false;
  let linkedinExpArchetypeUsed = false;
  let linkedinExpParserConfidence: "high" | "low" = "low";
  let linkedinExpRawCount = 0;
  let linkedinExpCoverage = 0;

  // PERF-HOTFIX: Experience rewrite mode tracking
  let experienceRewriteMode: "full_sonnet" | "fast_section" | "passthrough" = "full_sonnet";
  let experienceRewriteSkippedReason: string | null = null;
  let totalExperienceEntries = 0;
  let firstPassProcessedEntries = 0;
  let deferredExperienceEntries = 0;

  // PERF-HOTFIX-2: First-pass mode + time budget tracking
  let firstPassMode: "fast" | "full" = "full";
  let deferredEnhancements: string[] = [];
  let timeBudgetTriggered = false;
  let skippedStages: string[] = [];

  for (const sectionId of ["experience", "education"]) {
    if (linkedinSections[sectionId]) {
      // ── HOTFIX-5B: Pre-normalization pass for LinkedIn Experience ──
      let textToParse = linkedinSections[sectionId];

      if (sectionId === "experience") {
        // ── ARCHETYPE PARSER: deterministic-first, try before anything else ──
        const archetypeParsed = parseLinkedinExperienceArchetype(textToParse, requestId);
        linkedinExpParserConfidence = archetypeParsed.confidence;
        linkedinExpRawCount = archetypeParsed.entries.length;
        linkedinExpCoverage = archetypeParsed.totalLineCount
          ? Math.round(((archetypeParsed.coveredLineCount ?? 0) / archetypeParsed.totalLineCount) * 100)
          : 100;

        // D.7: Skip AI when archetype parser is confident
        if (archetypeParsed.confidence === "high" && archetypeParsed.entries.length > 0) {
          linkedinExpStructurerSkipped = true;
          linkedinExpArchetypeUsed = true;
          linkedinEntries[sectionId] = archetypeParsed.entries;
          console.log(
            `[perf] request=${requestId} | linkedinExp: archetype ACCEPTED (confidence=high, entries=${archetypeParsed.entries.length}, coverage=${linkedinExpCoverage}%)`
          );
          continue;
        }

        // Archetype gave low confidence — try legacy heuristic for comparison
        const rawParsed = parseEntriesFromSection(sectionId, textToParse);

        // If archetype found entries (even low confidence) and legacy also found entries,
        // prefer whichever has more entries or archetype if tied
        if (archetypeParsed.entries.length > 0 && archetypeParsed.entries.length >= rawParsed.entries.length) {
          linkedinExpArchetypeUsed = true;
          linkedinExpStructurerSkipped = true;
          linkedinEntries[sectionId] = archetypeParsed.entries;
          console.log(
            `[parser] request=${requestId} | linkedinExp: archetype preferred (archetype=${archetypeParsed.entries.length}, legacy=${rawParsed.entries.length}, coverage=${linkedinExpCoverage}%)`
          );
          continue;
        }

        // Both parsers gave low results — try AI fallbacks
        if (rawParsed.confidence === "low" && textToParse.length > 100) {
          console.log(
            `[diag] request=${requestId} | linkedinExp: low confidence (archetype=${archetypeParsed.entries.length}, legacy=${rawParsed.entries.length}), trying pre-normalization`
          );
          try {
            const { preNormalizeLinkedinExperience } = await import("./cv-work-exp-structurer");
            const normalized = await preNormalizeLinkedinExperience(textToParse);
            if (normalized) {
              // Re-parse the normalized text with archetype first
              const normalizedArchetype = parseLinkedinExperienceArchetype(normalized, requestId);
              if (normalizedArchetype.confidence === "high" && normalizedArchetype.entries.length > 0) {
                linkedinExpPreNormalized = true;
                linkedinExpArchetypeUsed = true;
                linkedinExpParserConfidence = normalizedArchetype.confidence;
                linkedinExpRawCount = normalizedArchetype.entries.length;
                linkedinExpCoverage = normalizedArchetype.totalLineCount
                  ? Math.round(((normalizedArchetype.coveredLineCount ?? 0) / normalizedArchetype.totalLineCount) * 100)
                  : 100;
                linkedinEntries[sectionId] = normalizedArchetype.entries;
                console.log(
                  `[parser] Pre-normalized → archetype: ${normalizedArchetype.entries.length} entries, confidence=high`
                );
                continue;
              }

              // Try legacy parser on normalized text
              const normalizedParsed = parseEntriesFromSection(sectionId, normalized);
              if (normalizedParsed.entries.length > rawParsed.entries.length ||
                  normalizedParsed.confidence === "high") {
                textToParse = normalized;
                linkedinExpPreNormalized = true;
                linkedinExpParserConfidence = normalizedParsed.confidence;
                linkedinExpRawCount = normalizedParsed.entries.length;
                linkedinExpCoverage = normalizedParsed.totalLineCount
                  ? Math.round(((normalizedParsed.coveredLineCount ?? 0) / normalizedParsed.totalLineCount) * 100)
                  : 100;
                linkedinEntries[sectionId] = normalizedParsed.entries;
                console.log(
                  `[parser] Pre-normalized LinkedIn experience: ${normalizedParsed.entries.length} entries ` +
                  `(was ${rawParsed.entries.length} before normalization, confidence=${normalizedParsed.confidence})`
                );
                continue;
              }
            }
          } catch (err) {
            console.warn(
              `[diag] linkedinExp pre-normalization failed: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }

          // Pre-normalization didn't help — fall back to full AI structuring
          console.log(
            `[diag] request=${requestId} | linkedinExp: pre-normalization didn't improve, trying full AI structuring`
          );
          try {
            const { structureWorkExperience } = await import("./cv-work-exp-structurer");
            const aiEntries = await structureWorkExperience(textToParse, "linkedin");
            if (aiEntries && aiEntries.length > 0) {
              linkedinEntries[sectionId] = aiEntries;
              linkedinExpAiStructured = true;
              console.log(
                `[parser] AI-structured ${aiEntries.length} entries from LinkedIn experience ` +
                `(replaced archetype=${archetypeParsed.entries.length}, legacy=${rawParsed.entries.length})`
              );
              continue;
            }
          } catch (err) {
            console.warn(
              `[diag] linkedinExp AI structuring failed, using best heuristic output: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }

        // Fall through: use best available entries (prefer archetype, then legacy)
        const bestEntries = archetypeParsed.entries.length >= rawParsed.entries.length
          ? archetypeParsed.entries
          : rawParsed.entries;
        if (bestEntries.length > 0) {
          linkedinEntries[sectionId] = bestEntries;
          linkedinExpArchetypeUsed = archetypeParsed.entries.length >= rawParsed.entries.length;
          console.log(
            `[parser] Parsed ${bestEntries.length} entries from LinkedIn ${sectionId} ` +
            `(archetype=${archetypeParsed.entries.length}, legacy=${rawParsed.entries.length}, used=${linkedinExpArchetypeUsed ? "archetype" : "legacy"})`
          );
        }
        continue; // Already handled experience
      }

      // Non-experience sections (education): normal parse
      const parsed = parseEntriesFromSection(sectionId, textToParse);

      // HOTFIX-4C: Accept ALL entries regardless of confidence (merge guard already ran)
      if (parsed.entries.length > 0) {
        linkedinEntries[sectionId] = parsed.entries;
        console.log(
          `[parser] Parsed ${parsed.entries.length} entries from LinkedIn ${sectionId} (confidence=${parsed.confidence})`
        );
      } else if (sectionId === "education") {
        // HOTFIX-URGENT: Diagnostic when education parsing fails
        console.warn(
          `[diag] EDUCATION_PARSE_FAIL: linkedin.education sectionChars=${linkedinSections[sectionId].length}, ` +
          `parsedEntries=${parsed.entries.length}, confidence=${parsed.confidence}, ` +
          `text_snippet="${linkedinSections[sectionId].slice(0, 200).replace(/\n/g, "\\n")}"`
        );
      }
    }
  }

  // HOTFIX-5B: Diagnostics for LinkedIn experience parsing (HOTFIX-6D: guard)
  if (hasLinkedinInput) {
    console.log(
      `[diag] request=${requestId} | LINKEDIN_EXP: ` +
      `parserConfidence=${linkedinExpParserConfidence}, ` +
      `parsedCount=${linkedinExpRawCount}, ` +
      `archetypeUsed=${linkedinExpArchetypeUsed}, ` +
      `preNormalized=${linkedinExpPreNormalized}, ` +
      `aiStructured=${linkedinExpAiStructured}, ` +
      `structurerSkipped=${linkedinExpStructurerSkipped}, ` +
      `coverage=${linkedinExpCoverage}%, ` +
      `finalCount=${linkedinEntries["experience"]?.length ?? 0}`
    );
  }

  // HOTFIX-6B: Heuristic count cross-check for LinkedIn entry-based sections
  if (hasLinkedinInput) {
    for (const sectionId of ["experience", "education"] as const) {
      if (linkedinSections[sectionId]) {
        const heuristicCount = estimateSectionEntryCount(linkedinSections[sectionId], sectionId);
        const parsedCount = linkedinEntries[sectionId]?.length ?? 0;
        const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
        // HOTFIX-8: Suppress alert when ratio is absurdly high (heuristic bug)
        const ratio = heuristicCount / Math.max(1, parsedCount);
        const isCredibleMismatch = mismatch && ratio <= 5.0;
        console.log(
          `[diag] request=${requestId} | COUNT_CROSSCHECK linkedin.${sectionId}: ` +
          `heuristicCount=${heuristicCount}, parsedCount=${parsedCount}, mismatch=${mismatch}, ratio=${ratio.toFixed(1)}x, credible=${isCredibleMismatch}`
        );
        if (isCredibleMismatch && parsedCount > 0) {
          console.warn(
            `[diag] request=${requestId} | COUNT_MISMATCH_ALERT linkedin.${sectionId}: ` +
            `expected≈${heuristicCount}, parsed=${parsedCount}, ratio=${ratio.toFixed(1)}x`
          );
          trackServerEvent("count_mismatch_detected", {
            auditId: requestId,
            metadata: { source: "linkedin", sectionId, expectedCountAI: heuristicCount, parsedCount, mismatchResolved: false },
          });
        }
      }
    }
  }

  const cvEntries: Record<string, ParsedEntry[]> = {};
  let cvWorkExpAiStructured = false;
  let cvWorkExpStructurerSkipped = false;
  let cvWorkExpParserConfidence: "high" | "low" = "low";
  let cvWorkExpRawCount = 0;
  let cvWorkExpMergedCount = 0;
  let cvWorkExpCoverage = 0;

  for (const sectionId of ["work-experience", "education-section"]) {
    if (cvSections[sectionId]) {
      const parsed = parseEntriesFromSection(sectionId, cvSections[sectionId]);

      // ── HOTFIX-5: AI structuring for work-experience — skip when confident ──
      if (sectionId === "work-experience") {
        cvWorkExpParserConfidence = parsed.confidence;
        cvWorkExpRawCount = parsed.entries.length;
        cvWorkExpMergedCount = parsed.entries.length;
        cvWorkExpCoverage = parsed.totalLineCount
          ? Math.round(((parsed.coveredLineCount ?? 0) / parsed.totalLineCount) * 100)
          : 100;

        // D.7: Skip AI structuring when confidence is high AND entries exist
        if (parsed.confidence === "high" && parsed.entries.length > 0) {
          cvWorkExpStructurerSkipped = true;
          console.log(
            `[perf] request=${requestId} | cvWorkExp: structurer SKIPPED (confidence=high, entries=${parsed.entries.length}, coverage=${cvWorkExpCoverage}%)`
          );
        } else if (parsed.entries.length === 0 && cvSections[sectionId].length > 100) {
          // HOTFIX-8: Fallback — 0 entries regardless of confidence → try AI structurer
          console.log(
            `[diag] request=${requestId} | cvWorkExp: 0 entries (confidence=${parsed.confidence}), fallback to AI structurer`
          );
          try {
            const { structureWorkExperience } = await import("./cv-work-exp-structurer");
            const aiEntries = await structureWorkExperience(cvSections[sectionId], "cv");
            if (aiEntries && aiEntries.length > 0) {
              cvEntries[sectionId] = aiEntries;
              cvWorkExpAiStructured = true;
              cvWorkExpMergedCount = aiEntries.length;
              console.log(
                `[parser] HOTFIX-8 fallback: AI-structured ${aiEntries.length} entries from CV work-experience`
              );
              continue; // Skip normal acceptance logic
            }
          } catch (err) {
            console.warn(
              `[diag] cvWorkExp fallback AI structuring failed: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        } else if (parsed.confidence === "low" && cvSections[sectionId].length > 100) {
          console.log(
            `[diag] request=${requestId} | cvWorkExp: low confidence (entries=${parsed.entries.length}), trying AI structuring`
          );
          try {
            const { structureWorkExperience } = await import("./cv-work-exp-structurer");
            const aiEntries = await structureWorkExperience(cvSections[sectionId], "cv");
            if (aiEntries && aiEntries.length > 0) {
              cvEntries[sectionId] = aiEntries;
              cvWorkExpAiStructured = true;
              cvWorkExpMergedCount = aiEntries.length;
              console.log(
                `[parser] AI-structured ${aiEntries.length} entries from CV work-experience ` +
                `(replaced ${parsed.entries.length} heuristic entries)`
              );
              continue; // Skip normal acceptance logic
            }
          } catch (err) {
            console.warn(
              `[diag] cvWorkExp AI structuring failed, using heuristic output: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
      }

      // Accept ALL entries regardless of confidence (merge guard already ran)
      if (parsed.entries.length > 0) {
        cvEntries[sectionId] = parsed.entries;
        console.log(
          `[parser] Parsed ${parsed.entries.length} entries from CV ${sectionId} (confidence=${parsed.confidence})`
        );
      }
    }
  }

  // HOTFIX-5: Diagnostics for CV work experience parsing
  console.log(
    `[diag] request=${requestId} | CV_WORK_EXP: ` +
    `cvWorkExpParserConfidence=${cvWorkExpParserConfidence}, ` +
    `cvWorkExpParsedCount=${cvWorkExpRawCount}, ` +
    `cvWorkExpMergedCount=${cvWorkExpMergedCount}, ` +
    `cvWorkExpAiStructured=${cvWorkExpAiStructured}, ` +
    `cvWorkExpStructurerSkipped=${cvWorkExpStructurerSkipped}, ` +
    `coverage=${cvWorkExpCoverage}%, ` +
    `cvWorkExpFinalCount=${cvEntries["work-experience"]?.length ?? 0}`
  );

  // HOTFIX-URGENT-2: Hard diagnostics for education entry counts
  const liEduEntryCount = linkedinEntries["education"]?.length ?? 0;
  const cvEduEntryCount = cvEntries["education-section"]?.length ?? 0;
  const liEduCharCount = (linkedinSections["education"] ?? "").length;
  const cvEduCharCount = (cvSections["education-section"] ?? "").length;
  console.log(
    `[diag] request=${requestId} | EDUCATION_ENTRIES: ` +
    `linkedin: extractedEducationChars=${liEduCharCount}, parsedEducationCount=${liEduEntryCount} | ` +
    `cv: extractedEducationChars=${cvEduCharCount}, parsedEducationCount=${cvEduEntryCount}`
  );

  // HOTFIX-6B: Heuristic count cross-check for CV entry-based sections
  if (hasCvInput) {
    for (const sectionId of ["work-experience", "education-section"] as const) {
      if (cvSections[sectionId]) {
        const heuristicCount = estimateSectionEntryCount(cvSections[sectionId], sectionId);
        const parsedCount = cvEntries[sectionId]?.length ?? 0;
        const mismatch = heuristicCount > parsedCount * 1.5 && heuristicCount >= 2;
        // HOTFIX-8: Suppress alert when ratio is absurdly high (heuristic bug)
        const ratio = heuristicCount / Math.max(1, parsedCount);
        const isCredibleMismatch = mismatch && ratio <= 5.0;
        console.log(
          `[diag] request=${requestId} | COUNT_CROSSCHECK cv.${sectionId}: ` +
          `heuristicCount=${heuristicCount}, parsedCount=${parsedCount}, mismatch=${mismatch}, ratio=${ratio.toFixed(1)}x, credible=${isCredibleMismatch}`
        );
        if (isCredibleMismatch && parsedCount > 0) {
          console.warn(
            `[diag] request=${requestId} | COUNT_MISMATCH_ALERT cv.${sectionId}: ` +
            `expected≈${heuristicCount}, parsed=${parsedCount}, ratio=${ratio.toFixed(1)}x`
          );
          trackServerEvent("count_mismatch_detected", {
            auditId: requestId,
            metadata: { source: "cv", sectionId, expectedCountAI: heuristicCount, parsedCount, mismatchResolved: false },
          });
        }
      }
    }
  }

  stageTimer.end();
  stageTimer.start("generating_rewrites");
  emitProgress("generating_rewrites", 45, "Generating optimized rewrites...");

  // ─── 5. Rewrite sections (parallel) — per-entry for experience/education ──
  // Sprint 2.1: Each rewrite promise emits sectionReady IMMEDIATELY on completion
  // (not batched after Promise.allSettled). This ensures incremental SSE delivery.
  const linkedinRewrites: RewritePreview[] = [];
  const cvRewrites: RewritePreview[] = [];
  const allScoredSections = [...scoredLinkedinSections, ...scoredCvSections];

  const handleRewriteResult = (
    section: ScoreSection,
    result: { rewrite: RewritePreview; modelUsed: string } | null,
  ) => {
    if (!result) {
      fallbackCount++;
      console.warn(`[fallback] Creating passthrough rewrite for: ${section.id}`);
      // HOTFIX-9d: Never silently drop a section — create a passthrough rewrite
      // so the section always appears in the Studio with fallback AI instructions.
      const passthroughRewrite: RewritePreview = {
        sectionId: section.id,
        source: section.source as "linkedin" | "cv",
        original: section.explanation ?? "",
        improvements: "",
        missingSuggestions: getFallbackSuggestions(section.id),
        rewritten: section.explanation ?? "",
        locked: false,
      };
      if (section.source === "linkedin") {
        linkedinRewrites.push(passthroughRewrite);
      } else {
        cvRewrites.push(passthroughRewrite);
      }

      // Still emit sectionReady so the UI shows this section
      completedSectionCount++;
      const pct = 45 + Math.round((completedSectionCount / Math.max(totalSectionCount, 1)) * 25);
      emitProgress(
        "generating_rewrites",
        Math.min(pct, 70),
        `${SECTION_DISPLAY_NAMES[section.id] ?? section.id} ready`,
        { section, rewrite: passthroughRewrite }
      );
      return;
    }
    const { rewrite } = result;
    primaryModel = result.modelUsed;
    if (rewrite.source === "linkedin") {
      linkedinRewrites.push(rewrite);
    } else {
      cvRewrites.push(rewrite);
    }

    // Sprint 2.1: Emit sectionReady IMMEDIATELY — fires as each rewrite resolves
    completedSectionCount++;
    const pct = 45 + Math.round((completedSectionCount / Math.max(totalSectionCount, 1)) * 25);
    emitProgress(
      "generating_rewrites",
      Math.min(pct, 70),
      `${SECTION_DISPLAY_NAMES[rewrite.sectionId] ?? rewrite.sectionId} ready`,
      { section, rewrite }
    );
  };

  const linkedinRewritePromises = scoredLinkedinSections.map((section) => {
    const content = linkedinSections[section.id] ??
      `[This section was not found in the profile. The user has not included a ${SECTION_DISPLAY_NAMES[section.id] ?? section.id} section.]`;

    // PERF-HOTFIX: Fast path for experience when archetype is confident
    if (
      section.id === "experience" &&
      linkedinExpArchetypeUsed &&
      linkedinExpParserConfidence === "high" &&
      linkedinEntries[section.id]?.length > 0
    ) {
      const fastPromise = fastSectionRewriteWithEntries(
        section.id,
        linkedinEntries[section.id],
        content,
        "rewrite.linkedin.section.entries",
        targetRole,
        jobObjective,
        framing,
        locale,
        promptVersions,
        failureReasons,
        sectionDiagnostics,
        retryAttemptsByReason
      );

      return fastPromise.then((fastResult) => {
        experienceRewriteMode = fastResult.mode;
        totalExperienceEntries = linkedinEntries[section.id].length;
        firstPassProcessedEntries = Math.min(MAX_ENTRIES_FIRST_PASS, totalExperienceEntries);
        deferredExperienceEntries = Math.max(0, totalExperienceEntries - firstPassProcessedEntries);
        const wrappedResult = { rewrite: fastResult.rewrite, modelUsed: fastResult.modelUsed };
        handleRewriteResult(section, wrappedResult);
        return { id: section.id, result: wrappedResult };
      }).catch((err) => {
        experienceRewriteMode = "passthrough";
        experienceRewriteSkippedReason = err instanceof Error ? err.message : "unknown";
        handleRewriteResult(section, null);
        throw err;
      });
    }

    // PERF-HOTFIX-2: Fast Haiku rewrite for headline/summary when archetype confident
    if (
      (section.id === "headline" || section.id === "summary") &&
      linkedinExpArchetypeUsed &&
      linkedinExpParserConfidence === "high"
    ) {
      firstPassMode = "fast";
      deferredEnhancements.push(section.id);

      const fastPromise = fastRewriteSection(
        section.id,
        content,
        "rewrite.linkedin.section",
        targetRole,
        jobObjective,
        framing,
        locale,
        promptVersions,
        failureReasons,
        sectionDiagnostics,
        retryAttemptsByReason
      );

      return fastPromise.then((fastResult) => {
        const wrappedResult = { rewrite: fastResult.rewrite, modelUsed: fastResult.modelUsed };
        handleRewriteResult(section, wrappedResult);
        return { id: section.id, result: wrappedResult };
      }).catch((err) => {
        handleRewriteResult(section, null);
        throw err;
      });
    }

    // Normal path: per-entry Sonnet rewrite or section-level rewrite
    const rewritePromise = (linkedinEntries[section.id] && linkedinEntries[section.id].length > 0)
      ? rewriteSectionWithEntries(
          section.id,
          linkedinEntries[section.id],
          content,
          "rewrite.linkedin.section.entries",
          targetRole,
          jobObjective,
          framing,
          locale,
          promptVersions,
          failureReasons,
          sectionDiagnostics,
          retryAttemptsByReason
        )
      : rewriteSection(
          section.id,
          content,
          "rewrite.linkedin.section",
          targetRole,
          jobObjective,
          framing,
          locale,
          promptVersions,
          failureReasons,
          sectionDiagnostics,
          retryAttemptsByReason
        );

    return rewritePromise.then((result) => {
      handleRewriteResult(section, result);
      return { id: section.id, result };
    }).catch((err) => {
      handleRewriteResult(section, null);
      throw err;
    });
  });

  // HOTFIX-CV-ONLY-ROUTING: Track CV first-pass mode for diagnostics
  let cvFirstPassMode: "fast" | "full" = "full";

  const cvRewritePromises = scoredCvSections.map((section) => {
    const content = cvSections[section.id] ??
      `[This section was not found in the CV. The user has not included a ${SECTION_DISPLAY_NAMES[section.id] ?? section.id} section.]`;

    // HOTFIX-CV-ONLY-ROUTING: Fast paths for CV sections
    let rewritePromise: Promise<{ rewrite: RewritePreview; modelUsed: string } | null>;

    // HOTFIX-9b: Skip LLM rewrite for contact-info — pass through original
    // The generic rewrite prompt causes LLM to hallucinate objective/headline text
    if (section.id === "contact-info") {
      rewritePromise = Promise.resolve({
        rewrite: {
          sectionId: "contact-info",
          source: "cv" as const,
          original: content,
          improvements: "",
          missingSuggestions: getFallbackSuggestions("contact-info"),
          rewritten: content,
          locked: false,
        },
        modelUsed: "passthrough",
      });
    } else if (
      section.id === "work-experience" &&
      cvEntries[section.id] &&
      cvEntries[section.id].length > 0
    ) {
      // HOTFIX-8: Fast path for CV work-experience with entries (any confidence) → Haiku
      cvFirstPassMode = "fast";
      rewritePromise = fastSectionRewriteWithEntries(
        section.id,
        cvEntries[section.id],
        content,
        "rewrite.cv.section.entries",
        targetRole,
        jobObjective,
        framing,
        locale,
        promptVersions,
        failureReasons,
        sectionDiagnostics,
        retryAttemptsByReason
      );
    } else if (section.id === "education-section") {
      // Fast path: CV education → always Haiku (small section)
      if (cvEntries[section.id] && cvEntries[section.id].length > 0) {
        rewritePromise = fastSectionRewriteWithEntries(
          section.id,
          cvEntries[section.id],
          content,
          "rewrite.cv.section.entries",
          targetRole,
          jobObjective,
          framing,
          locale,
          promptVersions,
          failureReasons,
          sectionDiagnostics,
          retryAttemptsByReason
        );
      } else {
        rewritePromise = fastRewriteSection(
          section.id,
          content,
          "rewrite.cv.section",
          targetRole,
          jobObjective,
          framing,
          locale,
          promptVersions,
          failureReasons,
          sectionDiagnostics,
          retryAttemptsByReason
        );
      }
    } else if (cvEntries[section.id] && cvEntries[section.id].length > 0) {
      // Normal path: other CV sections with entries → Sonnet
      rewritePromise = rewriteSectionWithEntries(
        section.id,
        cvEntries[section.id],
        content,
        "rewrite.cv.section.entries",
        targetRole,
        jobObjective,
        framing,
        locale,
        promptVersions,
        failureReasons,
        sectionDiagnostics,
        retryAttemptsByReason
      );
    } else {
      // Normal path: other CV sections without entries → Sonnet
      rewritePromise = rewriteSection(
        section.id,
        content,
        "rewrite.cv.section",
        targetRole,
        jobObjective,
        framing,
        locale,
        promptVersions,
        failureReasons,
        sectionDiagnostics,
        retryAttemptsByReason
      );
    }

    return rewritePromise.then((result) => {
      handleRewriteResult(section, result);
      return { id: section.id, result };
    }).catch((err) => {
      handleRewriteResult(section, null);
      throw err;
    });
  });

  // Wait for all rewrites to finish (sectionReady events already emitted individually above)
  await Promise.allSettled([
    ...linkedinRewritePromises,
    ...cvRewritePromises,
  ]);

  // HOTFIX-3: Rewrite-stage diagnostics
  console.log(
    `[diag] request=${requestId} | REWRITE_STAGE: ` +
    `linkedin=${linkedinRewrites.length} rewrites (entries: ${linkedinRewrites.reduce((sum, r) => sum + (r.entries?.length ?? 0), 0)}), ` +
    `cv=${cvRewrites.length} rewrites (entries: ${cvRewrites.reduce((sum, r) => sum + (r.entries?.length ?? 0), 0)})`
  );

  // PERF-HOTFIX: Experience rewrite mode diagnostics (LinkedIn-only)
  if (hasLinkedinInput) {
    console.log(
      `[diag] request=${requestId} | EXP_REWRITE_PERF: ` +
      `mode=${experienceRewriteMode}, ` +
      `skippedReason=${experienceRewriteSkippedReason ?? "none"}, ` +
      `totalEntries=${totalExperienceEntries}, ` +
      `firstPass=${firstPassProcessedEntries}, ` +
      `deferredEntries=${deferredExperienceEntries}, ` +
      `firstPassMode=${firstPassMode}, ` +
      `deferredEnhancements=[${deferredEnhancements.join(",")}], ` +
      `structuringSkipped=${structuringSkippedReason ?? "none"}, ` +
      `budgetTriggered=${timeBudgetTriggered}, ` +
      `skipped=[${skippedStages.join(",")}]`
    );
  }

  // HOTFIX-CV-ONLY-ROUTING: CV rewrite diagnostics
  if (hasCvInput) {
    console.log(
      `[diag] request=${requestId} | CV_REWRITE_PERF: ` +
      `cvFirstPassMode=${cvFirstPassMode}, ` +
      `cvSections=${scoredCvSections.length}, ` +
      `cvRewrites=${cvRewrites.length}, ` +
      `cvWorkExpConfidence=${cvWorkExpParserConfidence}, ` +
      `cvWorkExpEntries=${cvEntries["work-experience"]?.length ?? 0}, ` +
      `cvEduEntries=${cvEntries["education-section"]?.length ?? 0}, ` +
      `budgetTriggered=${timeBudgetTriggered}, ` +
      `elapsed=${Date.now() - startTime}ms`
    );
  }

  // ─── 5b. Quality guard diagnostics (logging only) ─────
  let repetitiveEntryCount = 0;
  let hallucinatedMetricCount = 0;

  // Check all rewrites that have entries for quality issues
  let totalBuzzwordCount = 0;
  let totalAddMetricTags = 0;
  let totalNeedsVerificationTags = 0;

  for (const rewrite of [...linkedinRewrites, ...cvRewrites]) {
    // Sprint 1: Buzzword and metric tag diagnostics on all rewrites
    const buzzwords = detectBuzzwords(rewrite.rewritten);
    if (buzzwords.length > 0) {
      totalBuzzwordCount += buzzwords.length;
      console.warn(
        `[diag] request=${requestId} | BUZZWORDS in ${rewrite.sectionId}: [${buzzwords.join(", ")}]`
      );
    }
    const metricTags = countMetricTags(rewrite.rewritten);
    totalAddMetricTags += metricTags.addMetric;
    totalNeedsVerificationTags += metricTags.needsVerification;

    if (rewrite.entries && rewrite.entries.length > 0) {
      const entryTexts = rewrite.entries.map((e) => e.rewritten);
      const repResult = hasRepetitiveEntryContent(entryTexts);
      if (repResult.repetitive) {
        repetitiveEntryCount++;
        console.warn(
          `[guard] Repetitive entry content detected in rewrite: ${rewrite.sectionId} ` +
          `(duplicatePairs=${repResult.duplicatePairs}/${repResult.totalPairs}, worstOverlap=${repResult.worstOverlap.toFixed(2)})`
        );
      }
      for (const entry of rewrite.entries) {
        const hallResult = detectHallucinatedMetrics(entry.original, entry.rewritten);
        if (hallResult.count > 0) {
          hallucinatedMetricCount += hallResult.count;
          console.warn(
            `[guard] Hallucinated metrics detected in rewrite: ${rewrite.sectionId}/${entry.entryTitle}, ` +
            `count=${hallResult.count}, severity=${hallResult.severity}, metrics=[${hallResult.metrics.join(", ")}]`
          );
        }
      }
    }
  }

  // Sprint 1: CV document-level word count check
  const cvRewriteTexts = cvRewrites.map((r) => r.rewritten);
  if (cvRewriteTexts.length > 0) {
    const cvWordCount = checkCvDocumentWordCount(cvRewriteTexts);
    console.log(
      `[diag] request=${requestId} | CV_WORD_COUNT: ${cvWordCount.wordCount} words, inRange=${cvWordCount.inRange}`
    );
  }

  if (repetitiveEntryCount > 0 || hallucinatedMetricCount > 0 || totalBuzzwordCount > 0) {
    console.log(
      `[diag] request=${requestId} | QUALITY_GUARDS: ` +
      `repetitiveEntries=${repetitiveEntryCount}, hallucinatedMetrics=${hallucinatedMetricCount}, ` +
      `buzzwords=${totalBuzzwordCount}, addMetricTags=${totalAddMetricTags}, needsVerificationTags=${totalNeedsVerificationTags}`
    );
  }

  stageTimer.end();
  stageTimer.start("scoring_entries");
  emitProgress("scoring_entries", 70, "Scoring individual entries...");

  // ─── 5c. Entry-level scoring (behind ENABLE_ENTRY_SCORING flag) ──
  const ENTRY_SCORING_SECTION_IDS_LINKEDIN = ["experience", "education"];
  const ENTRY_SCORING_SECTION_IDS_CV = ["work-experience", "education-section"];
  const ENTRY_SCORING_CONCURRENCY = 2; // max in-flight calls to reduce 429 risk

  const entryScoringStart = Date.now();
  let entryScoringTargetCount = 0;
  let entryScoringSuccessCount = 0;
  let entryScoringFailCount = 0;

  // PERF-HOTFIX-2: Skip entry scoring if time budget exceeded
  const entryScoringBudgetExceeded = Date.now() - startTime > ORCHESTRATION_BUDGET_MS;
  if (entryScoringBudgetExceeded) {
    timeBudgetTriggered = true;
    skippedStages.push("entry_scoring");
    console.log(
      `[perf] request=${requestId} | Time budget exceeded (${Date.now() - startTime}ms > ${ORCHESTRATION_BUDGET_MS}ms), skipping entry_scoring`
    );
  }

  if (ENABLE_ENTRY_SCORING && !entryScoringBudgetExceeded) {
    const entryScoreTargets: Array<{
      section: ScoreSection;
      entries: ParsedEntry[];
      promptKey: string;
    }> = [];

    // LinkedIn: only experience + education
    for (const section of scoredLinkedinSections) {
      if (
        ENTRY_SCORING_SECTION_IDS_LINKEDIN.includes(section.id) &&
        linkedinEntries[section.id] &&
        linkedinEntries[section.id].length >= 2
      ) {
        // PERF-HOTFIX: Skip experience scoring when fast/passthrough mode
        if (section.id === "experience" && experienceRewriteMode !== "full_sonnet") {
          console.log(
            `[perf] Skipping experience entry scoring (mode=${experienceRewriteMode})`
          );
          continue;
        }

        entryScoreTargets.push({
          section,
          entries: linkedinEntries[section.id],
          promptKey: "audit.linkedin.entry.system",
        });
      }
    }

    // CV: only work-experience + education-section
    for (const section of scoredCvSections) {
      if (
        ENTRY_SCORING_SECTION_IDS_CV.includes(section.id) &&
        cvEntries[section.id] &&
        cvEntries[section.id].length >= 2
      ) {
        entryScoreTargets.push({
          section,
          entries: cvEntries[section.id],
          promptKey: "audit.cv.entry.system",
        });
      }
    }

    entryScoringTargetCount = entryScoreTargets.length;

    // Execute in batches of ENTRY_SCORING_CONCURRENCY to limit API pressure
    for (let i = 0; i < entryScoreTargets.length; i += ENTRY_SCORING_CONCURRENCY) {
      const batch = entryScoreTargets.slice(i, i + ENTRY_SCORING_CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(({ section, entries, promptKey }) =>
          scoreSectionWithEntries(
            section.id,
            entries,
            promptKey,
            targetRole,
            framing,
            locale,
            promptVersions,
            failureReasons,
            sectionDiagnostics,
            retryAttemptsByReason
          ).then((scores) => ({ sectionId: section.id, scores }))
        )
      );

      for (const settled of batchResults) {
        if (settled.status === "fulfilled" && settled.value.scores) {
          const target = [...scoredLinkedinSections, ...scoredCvSections]
            .find((s) => s.id === settled.value.sectionId);
          if (target) {
            target.entryScores = settled.value.scores;
            entryScoringSuccessCount++;
          }
        } else {
          entryScoringFailCount++;
        }
      }
    }

    console.log(
      `[diag] request=${requestId} | ENTRY_SCORING: ` +
      `targets=${entryScoringTargetCount}, success=${entryScoringSuccessCount}, ` +
      `fail=${entryScoringFailCount}, duration=${Date.now() - entryScoringStart}ms`
    );
  }

  stageTimer.end();
  stageTimer.start("generating_extras");
  emitProgress("generating_extras", 80, "Generating cover letter & summary...");

  // ─── 6. Cover letter (if pro/coach/admin) ────────────
  let coverLetter: CoverLetterResult | null = null;
  // PERF-HOTFIX-2: Skip cover letter if time budget exceeded
  const coverLetterBudgetExceeded = Date.now() - startTime > ORCHESTRATION_BUDGET_MS;
  if (coverLetterBudgetExceeded) {
    timeBudgetTriggered = true;
    if (!skippedStages.includes("cover_letter")) skippedStages.push("cover_letter");
    console.log(
      `[perf] request=${requestId} | Time budget exceeded (${Date.now() - startTime}ms > ${ORCHESTRATION_BUDGET_MS}ms), skipping cover_letter`
    );
  }

  const shouldGenerateCoverLetter =
    (input.isAdmin || input.planId === "recommended") && !coverLetterBudgetExceeded;

  if (shouldGenerateCoverLetter) {
    const keyStrengths = scoredLinkedinSections
      .filter(
        (s) => s.tier === "excellent" || s.tier === "good"
      )
      .map((s) => SECTION_DISPLAY_NAMES[s.id] ?? s.id)
      .join(", ");

    const overallScore = computeOverallScore([
      ...scoredLinkedinSections,
      ...scoredCvSections,
    ]);

    const clResult = await generateCoverLetter(
      targetRole,
      jobObjective,
      keyStrengths || "General professional strengths",
      overallScore,
      framing,
      locale,
      promptVersions,
      failureReasons
    );

    if (clResult) {
      coverLetter = clResult.coverLetter;
    } else {
      // PR2C: No mock cover letter — just count and leave null
      fallbackCount++;
      console.warn(`[fallback] Skipping cover letter (no mock)`);
    }
  }

  // ─── 7. Compute overall score ────────────────────────
  const allSections = [...scoredLinkedinSections, ...scoredCvSections];
  const overallScore = computeOverallScore(allSections);
  const overallTier = tierFromScore(overallScore);

  // ─── 7b. Generate overall descriptor (non-blocking) ──
  const headlineExplanation =
    scoredLinkedinSections.find((s) => s.id === "headline")?.explanation ??
    scoredLinkedinSections[0]?.explanation ??
    "";

  const overallDescriptor = await generateOverallDescriptor(
    allSections,
    overallScore,
    overallTier,
    headlineExplanation,
    framing,
    locale,
    promptVersions,
    failureReasons
  );

  stageTimer.end();
  stageTimer.start("finalizing_results");
  emitProgress("finalizing_results", 90, "Finalizing your results...");

  // ─── 8. Apply plan-based locking ─────────────────────
  const linkedinIds = scoredLinkedinSections.map((s) => s.id);
  const cvIds = scoredCvSections.map((s) => s.id);
  const unlockedLinkedin = getUnlockedLinkedinIds(
    linkedinIds,
    input.planId,
    input.isAdmin
  );
  const unlockedCv = getUnlockedCvIds(cvIds, input.planId, input.isAdmin);

  const lockedLinkedinSections = scoredLinkedinSections.map((s) => ({
    ...s,
    locked: !unlockedLinkedin.includes(s.id),
  }));

  const lockedCvSections = scoredCvSections.map((s) => ({
    ...s,
    locked: !unlockedCv.includes(s.id),
  }));

  const lockedLinkedinRewrites = linkedinRewrites.map((r) => ({
    ...r,
    locked: !unlockedLinkedin.includes(r.sectionId),
  }));

  const lockedCvRewrites = cvRewrites.map((r) => ({
    ...r,
    locked: !unlockedCv.includes(r.sectionId),
  }));

  const lockedCoverLetter = coverLetter
    ? {
        ...coverLetter,
        locked: !isCoverLetterUnlockedForPlan(input.planId, input.isAdmin),
      }
    : null;

  // ─── 9. Assemble result ──────────────────────────────
  const sectionCountGenerated = allSections.length;
  const results: ProfileResult = {
    overallScore,
    maxScore: 100,
    tier: overallTier,
    overallDescriptor,
    linkedinSections: lockedLinkedinSections,
    cvSections: lockedCvSections,
    linkedinRewrites: lockedLinkedinRewrites,
    cvRewrites: lockedCvRewrites,
    coverLetter: lockedCoverLetter,
  };

  // ─── 9b. Post-assembly mock leak scan ─────────────────
  // Count mock leaks in final output for integrity reporting
  for (const section of allSections) {
    if (isMockSection(section)) mockLeaksDetected++;
  }
  for (const rewrite of [...linkedinRewrites, ...cvRewrites]) {
    if (isMockRewrite(rewrite)) mockLeaksDetected++;
  }
  if (coverLetter && isPlaceholderContent(coverLetter.content)) {
    mockLeaksDetected++;
  }

  const durationMs = Date.now() - startTime;

  // ─── 9c. Compute degraded state (P0-2, fixed denominator) ─────────
  // totalExpectedOperations counts ALL fallback-able operations, not just section IDs.
  // Each section has a score + rewrite, plus optional cover letter.
  // Previously this used section IDs only, making the ratio too sensitive
  // (e.g. 3 rewrite failures / 7 section IDs = 42.8% > 30% = false degraded).
  const expectedScoreSections =
    (hasLinkedinInput ? LINKEDIN_SECTION_IDS.length : 0) +
    (hasCvInput ? CV_SECTION_IDS.length : 0);
  const expectedRewriteSections = scoredLinkedinSections.length + scoredCvSections.length;
  const expectedCoverLetter = shouldGenerateCoverLetter ? 1 : 0;
  const totalExpectedOperations =
    expectedScoreSections + expectedRewriteSections + expectedCoverLetter;
  const degraded =
    totalExpectedOperations > 0 &&
    fallbackCount / totalExpectedOperations >= DEGRADED_FALLBACK_THRESHOLD;

  // Deduplicate failure reasons for client
  const uniqueFailureReasons = [...new Set(failureReasons)];

  // PR2C: Compute observability counters from failureReasons
  const normalizedSuggestionsCount = failureReasons.filter(
    (r) => r === "normalized_suggestions"
  ).length;
  const invalidJsonTooBigCount = failureReasons.filter(
    (r) => r === "invalid_json_too_big"
  ).length;
  const retryTooBigSuccessCount = failureReasons.filter(
    (r) => r === "retry_too_big_success"
  ).length;

  // PR2C-post: Compute core/non-core failure counts and reason distribution
  const coreFailureCount = sectionDiagnostics.filter((d) => d.isCore).length;
  const nonCoreFailureCount = sectionDiagnostics.filter((d) => !d.isCore).length;
  totalLLMTimeMs = sectionDiagnostics.reduce((sum, d) => sum + d.durationMs, 0);

  const fallbackReasonDistribution: Record<string, number> = {};
  for (const d of sectionDiagnostics) {
    fallbackReasonDistribution[d.reason] = (fallbackReasonDistribution[d.reason] || 0) + 1;
  }

  // PR2C-post: Soft alert thresholds
  if (coreFailureCount > 0) {
    console.error(
      `[ALERT] request=${requestId} | Core section failures: ${coreFailureCount} — results may be unreliable`
    );
  }
  if (durationMs > 120_000) {
    console.warn(
      `[ALERT] request=${requestId} | Total duration ${durationMs}ms exceeds 120s soft limit`
    );
  }
  if (totalLLMTimeMs > 90_000) {
    console.warn(
      `[ALERT] request=${requestId} | Total LLM time ${totalLLMTimeMs}ms exceeds 90s soft limit`
    );
  }
  if (sectionDiagnostics.length > 3) {
    console.warn(
      `[ALERT] request=${requestId} | High failure rate: ${sectionDiagnostics.length} section failures`
    );
  }

  // ─── 10. Integrity log (P0-1: structured diagnostics) ──
  console.log(
    `[diag] request=${requestId} | ` +
    `duration=${durationMs}ms | llmTime=${totalLLMTimeMs}ms | ` +
    `sections=${sectionCountGenerated} | ` +
    `rewrites=${linkedinRewrites.length + cvRewrites.length} | ` +
    `fallbacks=${fallbackCount}/${totalExpectedOperations} | ` +
    `coreFailures=${coreFailureCount} | nonCoreFailures=${nonCoreFailureCount} | ` +
    `mockLeaks=${mockLeaksDetected} | ` +
    `degraded=${degraded} | ` +
    `normalized=${normalizedSuggestionsCount} | ` +
    `tooBig=${invalidJsonTooBigCount} | ` +
    `tooBigRetryOK=${retryTooBigSuccessCount} | ` +
    `preflight=${preflightResult.passed ? "OK" : `FAIL:${preflightResult.missing.join(",")}`} | ` +
    `isAdmin=${input.isAdmin} | ` +
    `plan=${input.planId} | ` +
    `model=${primaryModel} | ` +
    `failureReasons=[${uniqueFailureReasons.join(",")}] | ` +
    `retryAttempts=${JSON.stringify(retryAttemptsByReason)} | ` +
    `reasonDist=${JSON.stringify(fallbackReasonDistribution)} | ` +
    `promptVersions=${JSON.stringify(promptVersions)}`
  );

  stageTimer.end();
  const stageTimings = stageTimer.getTimings();

  // Sprint 2: Performance diagnostics log
  const ttfp = firstProgressMs > 0 ? firstProgressMs - startTime : -1;
  const ttfs = firstSectionMs > 0 ? firstSectionMs - startTime : -1;
  console.log(
    `[perf] request=${requestId} | total=${durationMs}ms | ttfp=${ttfp}ms | ` +
    `ttfs=${ttfs}ms | llmCalls=${llmCallCount} | ` +
    `stages=${Object.entries(stageTimings).map(([s, d]) => `${s}:${d}ms`).join(",")} | ` +
    `sectionsSkipped=${sectionsSkipped}`
  );

  // ─── 11. Track analytics events (fire-and-forget) ─────
  trackServerEvent("llm_audit_generated", {
    metadata: {
      durationMs,
      sectionCount: sectionCountGenerated,
      model: primaryModel,
      fallbackCount,
      locale,
      mockLeaksDetected,
      promptVersions: JSON.stringify(promptVersions),
    },
  });

  // Track individual rewrite events
  for (const rw of [...linkedinRewrites, ...cvRewrites]) {
    trackServerEvent("llm_rewrite_generated", {
      metadata: {
        sectionId: rw.sectionId,
        source: rw.source,
        model: LLM_MODEL_QUALITY,
      },
    });
  }

  // Track cover letter generation
  if (coverLetter) {
    trackServerEvent("llm_export_generated", {
      metadata: {
        type: "cover-letter",
        durationMs,
        model: LLM_MODEL_QUALITY,
      },
    });
  }

  // Track fallbacks
  if (fallbackCount > 0) {
    trackServerEvent("llm_fallback_used", {
      metadata: {
        fallbackCount,
        reason: "parse_or_llm_failure",
        locale,
      },
    });
  }

  // ─── 12. Store in DB cache (fire-and-forget) ──────────
  // Only cache when ALL sections were real LLM results AND no mock leaks
  if (fallbackCount === 0 && mockLeaksDetected === 0) {
    computeInputHash({
      linkedinText: input.linkedinText,
      cvText: input.cvText,
      jobDescription: input.jobDescription,
      locale,
      objectiveMode: input.objectiveMode,
      objectiveText: input.objectiveText,
    })
      .then((hash) =>
        setCachedResult(hash, results, primaryModel, promptVersions)
      )
      .catch(() => {}); // Cache writes must never break flow
  } else {
    console.log(
      `[cache] Skipping cache: fallbacks=${fallbackCount}, mockLeaks=${mockLeaksDetected}`
    );
  }

  return {
    results,
    meta: {
      modelUsed: primaryModel,
      promptVersionsUsed: promptVersions,
      durationMs,
      fallbackCount,
      hasFallback: fallbackCount > 0,
      sectionCountGenerated,
      mockLeaksDetected,
      degraded,
      failureReasons: uniqueFailureReasons,
      normalizedSuggestionsCount,
      invalidJsonTooBigCount,
      retryTooBigSuccessCount,
      sectionDiagnostics,
      coreFailureCount,
      nonCoreFailureCount,
      fallbackReasonDistribution,
      retryAttemptsByReason,
      totalLLMTimeMs,
      preflightResult,
      // v1: Structuring + language detection + quality guards
      structuringUsed,
      structuringDurationMs,
      detectedLanguage: langResult.language,
      languageConfidence: langResult.confidence,
      repetitiveEntryCount,
      hallucinatedMetricCount,
      // v2: Entry scoring diagnostics
      entryScoringSectionCount: entryScoringTargetCount,
      entryScoringSuccessCount,
      entryScoringFailCount,
      entryScoringDurationMs: Date.now() - entryScoringStart,
      // Sprint 2: Perf observability
      stageTimings,
      timeToFirstProgressMs: ttfp >= 0 ? ttfp : undefined,
      timeToFirstSectionMs: ttfs >= 0 ? ttfs : undefined,
      llmCallCount,
      sectionsSkipped,
      // PERF-HOTFIX: Experience rewrite perf tracking
      experienceRewriteMode,
      experienceRewriteSkippedReason: experienceRewriteSkippedReason ?? undefined,
      deferredExperienceEntries,
      // PERF-HOTFIX-2: Extended diagnostics
      structuringSkippedReason: structuringSkippedReason ?? undefined,
      totalExperienceEntries: totalExperienceEntries || undefined,
      firstPassProcessedEntries: firstPassProcessedEntries || undefined,
      firstPassMode,
      deferredEnhancements: deferredEnhancements.length > 0 ? deferredEnhancements : undefined,
      timeBudgetMs: Date.now() - startTime,
      timeBudgetTriggered,
      skippedStages: skippedStages.length > 0 ? skippedStages : undefined,
      cvFirstPassMode: hasCvInput ? cvFirstPassMode : undefined,
    },
  };
}

// ── Re-apply plan locking to cached results ─────────────
function applyPlanLocking(
  cached: ProfileResult,
  input: AuditInput
): ProfileResult {
  const linkedinIds = cached.linkedinSections.map((s) => s.id);
  const cvIds = cached.cvSections.map((s) => s.id);
  const unlockedLinkedin = getUnlockedLinkedinIds(
    linkedinIds,
    input.planId,
    input.isAdmin
  );
  const unlockedCv = getUnlockedCvIds(cvIds, input.planId, input.isAdmin);

  return {
    ...cached,
    linkedinSections: cached.linkedinSections.map((s) => ({
      ...s,
      locked: !unlockedLinkedin.includes(s.id),
    })),
    cvSections: cached.cvSections.map((s) => ({
      ...s,
      locked: !unlockedCv.includes(s.id),
    })),
    linkedinRewrites: cached.linkedinRewrites.map((r) => ({
      ...r,
      locked: !unlockedLinkedin.includes(r.sectionId),
    })),
    cvRewrites: cached.cvRewrites.map((r) => ({
      ...r,
      locked: !unlockedCv.includes(r.sectionId),
    })),
    coverLetter: cached.coverLetter
      ? {
          ...cached.coverLetter,
          locked: !isCoverLetterUnlockedForPlan(input.planId, input.isAdmin),
        }
      : null,
  };
}

// ── Helpers ─────────────────────────────────────────────
function computeOverallScore(sections: ScoreSection[]): number {
  if (sections.length === 0) return 0;
  const sum = sections.reduce((acc, s) => acc + s.score, 0);
  return Math.round(sum / sections.length);
}
