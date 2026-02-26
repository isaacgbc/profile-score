import type {
  PlanId,
  Locale,
  ProfileResult,
  ScoreSection,
  RewritePreview,
  RewriteEntry,
  CoverLetterResult,
  ScoreTier,
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
  normalizeTier,
  tierFromScore,
  extractJson,
  normalizeAuditOutput,
} from "@/lib/schemas/llm-output";
import {
  parseLinkedinSectionsWithFallback,
  parseEntriesFromSection,
  LINKEDIN_SECTION_IDS,
  CV_SECTION_IDS,
  SECTION_DISPLAY_NAMES,
  MAX_ENTRIES_PER_SECTION,
  MAX_CHARS_PER_ENTRY,
} from "./linkedin-parser";
import type { ParsedEntry } from "./linkedin-parser";
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
}

export interface GenerationResult {
  results: ProfileResult;
  meta: GenerationMeta;
}

// ── Privacy: max input length per section ───────────────
const MAX_SECTION_CHARS = 10_000;

function truncate(text: string, max: number = MAX_SECTION_CHARS): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
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
    section_content: truncate(sectionContent),
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
    original_content: truncate(originalContent),
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
      const userMessage =
        attempt === 0
          ? "Rewrite this section. Respond in JSON format with keys: original, improvements, missingSuggestions, rewritten."
          : "Your previous response was not valid JSON. Please respond with ONLY a valid JSON object with keys: original, improvements, missingSuggestions, rewritten.";

      const result = await callLLM({
        model: LLM_MODEL_QUALITY,
        systemPrompt: attempt === 0 ? systemPrompt : systemPrompt + "\n\nIMPORTANT: Respond with ONLY valid JSON, no other text.",
        userMessage,
        maxTokens: 4096,
      });

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
  // Cost cap: limit entries and per-entry length
  const cappedEntries = entries.slice(0, MAX_ENTRIES_PER_SECTION).map((e, i) => ({
    index: i,
    title: e.title.slice(0, 200),
    organization: e.organization.slice(0, 200),
    dateRange: e.dateRange.slice(0, 100),
    description: e.description.slice(0, MAX_CHARS_PER_ENTRY),
  }));

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
    original_content: truncate(fullSectionContent),
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
      const userMessage =
        attempt === 0
          ? `Rewrite this ${SECTION_DISPLAY_NAMES[sectionId] ?? sectionId} section. Provide BOTH a section-level summary AND per-entry rewrites. Respond in JSON with keys: original, improvements, missingSuggestions, rewritten, entries (array of {entryTitle, original, improvements, missingSuggestions, rewritten}).`
          : "Your previous response was not valid JSON. Please respond with ONLY valid JSON.";

      const result = await callLLM({
        model: LLM_MODEL_QUALITY,
        systemPrompt:
          attempt === 0
            ? systemPrompt
            : systemPrompt + "\n\nIMPORTANT: Respond with ONLY valid JSON.",
        userMessage,
        maxTokens: 4096,
      });

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
        const rewriteEntries: RewriteEntry[] = (parsed.data.entries ?? []).map(
          (e, i) => ({
            entryIndex: i,
            entryTitle: e.entryTitle,
            original: e.original,
            improvements: e.improvements,
            missingSuggestions: e.missingSuggestions,
            rewritten: stripNonFlagEmojis(e.rewritten),
          })
        );

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

        if (isMockRewrite(rewrite)) {
          console.warn(
            `[guard] Mock fingerprint in entry rewrite ${sectionId} (attempt ${attempt + 1}), retrying`
          );
          failureReasons.push("mock_fingerprint_retry");
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

  const cvHeaders: { pattern: RegExp; id: string }[] = [
    { pattern: /^contact\s*(info|information|details)?$/i, id: "contact-info" },
    {
      pattern: /^(professional\s+)?summary|profile|objective$/i,
      id: "professional-summary",
    },
    {
      pattern: /^(work\s+)?experience|employment(\s+history)?$/i,
      id: "work-experience",
    },
    { pattern: /^(technical\s+)?skills|competencies$/i, id: "skills-section" },
    { pattern: /^education$/i, id: "education-section" },
    {
      pattern: /^certifications?|licenses?|awards?|honors?$/i,
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

  // If no sections were parsed, treat the whole text as professional-summary
  if (Object.keys(sections).length === 0 && cvText.trim().length > 0) {
    sections["professional-summary"] = truncate(cvText.trim());
  }

  return sections;
}

// ── Main orchestrator ───────────────────────────────────
export async function generateAuditResults(
  input: AuditInput,
  locale: Locale = "en"
): Promise<GenerationResult> {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  const promptVersions: Record<string, number> = {};
  const failureReasons: FailureReason[] = [];
  let fallbackCount = 0;
  let mockLeaksDetected = 0;
  let primaryModel = LLM_MODEL_FAST;

  // PR2C: per-section diagnostics + retry tracking
  const sectionDiagnostics: SectionDiagnostic[] = [];
  const retryAttemptsByReason: Record<string, number> = {};
  let totalLLMTimeMs = 0;

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

  // P0-3: Verify LLM env vars are set (detect trailing newline issues)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() !== apiKey) {
    console.error(`[diag] ANTHROPIC_API_KEY issue: set=${!!apiKey}, hasWhitespace=${apiKey ? apiKey.trim() !== apiKey : false}`);
  }

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

  // ─── 1b. Parse input sections ─────────────────────────
  const linkedinSections = input.linkedinText.trim()
    ? await parseLinkedinSectionsWithFallback(input.linkedinText, locale)
    : {};

  const cvSections =
    input.cvText && input.cvText.trim().length > 20
      ? parseCvSections(input.cvText)
      : {};

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
    `cv_parsed=[${parsedCvIds.join(", ")}]`
  );

  // ─── 2. Score LinkedIn sections (parallel) ────────────
  // Score ALL standard sections — missing ones get guidance content
  const linkedinScorePromises = (hasLinkedinInput ? LINKEDIN_SECTION_IDS : []).map(
    (id) => {
      const content =
        linkedinSections[id] ||
        `[This section was not found in the profile. The user has not included a ${SECTION_DISPLAY_NAMES[id] ?? id} section.]`;
      return scoreSection(
        id,
        content,
        "audit.linkedin.system",
        targetRole,
        framing,
        locale,
        promptVersions,
        failureReasons,
        sectionDiagnostics,
        retryAttemptsByReason
      ).then((result) => ({ id, result }));
    }
  );

  // ─── 3. Score CV sections (parallel) ──────────────────
  // Score ALL standard CV sections when CV input exists — missing ones get guidance
  const cvScorePromises = (hasCvInput ? CV_SECTION_IDS : []).map(
    (id) => {
      const content =
        cvSections[id] ||
        `[This section was not found in the CV. The user has not included a ${SECTION_DISPLAY_NAMES[id] ?? id} section.]`;
      return scoreSection(
        id,
        content,
        "audit.cv.system",
        targetRole,
        framing,
        locale,
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
  for (const sectionId of ["experience", "education"]) {
    if (linkedinSections[sectionId]) {
      const parsed = parseEntriesFromSection(
        sectionId,
        linkedinSections[sectionId]
      );
      if (parsed.entries.length > 0 && parsed.confidence === "high") {
        linkedinEntries[sectionId] = parsed.entries;
        console.log(
          `[parser] Parsed ${parsed.entries.length} entries from LinkedIn ${sectionId} (confidence=${parsed.confidence})`
        );
      }
    }
  }

  const cvEntries: Record<string, ParsedEntry[]> = {};
  for (const sectionId of ["work-experience", "education-section"]) {
    if (cvSections[sectionId]) {
      const parsed = parseEntriesFromSection(sectionId, cvSections[sectionId]);
      if (parsed.entries.length > 0 && parsed.confidence === "high") {
        cvEntries[sectionId] = parsed.entries;
        console.log(
          `[parser] Parsed ${parsed.entries.length} entries from CV ${sectionId} (confidence=${parsed.confidence})`
        );
      }
    }
  }

  // ─── 5. Rewrite sections (parallel) — per-entry for experience/education ──
  const linkedinRewritePromises = scoredLinkedinSections.map((section) => {
    const content = linkedinSections[section.id] ??
      `[This section was not found in the profile. The user has not included a ${SECTION_DISPLAY_NAMES[section.id] ?? section.id} section.]`;

    // Use per-entry rewrite for sections with parsed entries
    if (linkedinEntries[section.id] && linkedinEntries[section.id].length > 0) {
      return rewriteSectionWithEntries(
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
      ).then((result) => ({ id: section.id, result }));
    }

    return rewriteSection(
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
    ).then((result) => ({ id: section.id, result }));
  });

  const cvRewritePromises = scoredCvSections.map((section) => {
    const content = cvSections[section.id] ??
      `[This section was not found in the CV. The user has not included a ${SECTION_DISPLAY_NAMES[section.id] ?? section.id} section.]`;

    // Use per-entry rewrite for sections with parsed entries
    if (cvEntries[section.id] && cvEntries[section.id].length > 0) {
      return rewriteSectionWithEntries(
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
      ).then((result) => ({ id: section.id, result }));
    }

    return rewriteSection(
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
    ).then((result) => ({ id: section.id, result }));
  });

  const allRewriteResults = await Promise.allSettled([
    ...linkedinRewritePromises,
    ...cvRewritePromises,
  ]);

  const linkedinRewrites: RewritePreview[] = [];
  const cvRewrites: RewritePreview[] = [];

  for (const settled of allRewriteResults) {
    if (settled.status === "fulfilled" && settled.value.result) {
      const rewrite = settled.value.result.rewrite;
      primaryModel = settled.value.result.modelUsed;
      if (rewrite.source === "linkedin") {
        linkedinRewrites.push(rewrite);
      } else {
        cvRewrites.push(rewrite);
      }
    } else {
      // PR2C: No mock injection for rewrites — just count and skip
      fallbackCount++;
      const id =
        settled.status === "fulfilled" ? settled.value.id : "unknown";
      console.warn(`[fallback] Skipping rewrite (no mock): ${id}`);
    }
  }

  // ─── 6. Cover letter (if pro/coach/admin) ────────────
  let coverLetter: CoverLetterResult | null = null;
  const shouldGenerateCoverLetter =
    input.isAdmin || input.planId === "coach";

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
