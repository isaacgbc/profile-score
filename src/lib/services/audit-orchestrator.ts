import type {
  PlanId,
  Locale,
  ProfileResult,
  ScoreSection,
  RewritePreview,
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
  CoverLetterOutput,
  normalizeTier,
  tierFromScore,
  extractJson,
} from "@/lib/schemas/llm-output";
import {
  parseLinkedinSectionsWithFallback,
  LINKEDIN_SECTION_IDS,
  CV_SECTION_IDS,
  SECTION_DISPLAY_NAMES,
} from "./linkedin-parser";
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
} from "./generation-guards";

// ── Failure reason categories (P0-1: structured diagnostics) ──
export type FailureReason =
  | "timeout"
  | "rate_limit_429"
  | "invalid_json"
  | "missing_prompt"
  | "empty_input"
  | "parser_fail"
  | "circuit_breaker_open"
  | "mock_fingerprint_retry"
  | "generic_output_retry"
  | "unknown";

function categorizeError(err: unknown): FailureReason {
  if (!(err instanceof Error)) return "unknown";
  const msg = err.message.toLowerCase();
  if (msg.includes("circuit breaker")) return "circuit_breaker_open";
  if (msg.includes("429") || msg.includes("rate limit") || msg.includes("rate_limit")) return "rate_limit_429";
  if (msg.includes("abort") || msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (msg.includes("json") || msg.includes("parse")) return "invalid_json";
  return "unknown";
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
  failureReasons: FailureReason[]
): Promise<{ section: ScoreSection; modelUsed: string } | null> {
  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) {
    failureReasons.push("missing_prompt");
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

  // Try LLM call with one retry on parse failure
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const userMessage =
        attempt === 0
          ? "Score this section and provide actionable feedback."
          : "Your previous response was not valid JSON. Please respond with ONLY a valid JSON object with keys: score, tier, explanation, suggestions.";

      const result = await callLLM({
        model: LLM_MODEL_FAST,
        systemPrompt: attempt === 0 ? systemPrompt : systemPrompt + "\n\nIMPORTANT: Respond with ONLY valid JSON, no other text.",
        userMessage,
      });

      const jsonStr = extractJson(result.text);
      const parsed = AuditSectionOutput.safeParse(JSON.parse(jsonStr));

      if (parsed.success) {
        const section: ScoreSection = {
          id: sectionId,
          score: parsed.data.score,
          maxScore: 100,
          tier: normalizeTier(parsed.data.tier),
          locked: false, // locking applied later
          source: promptKey.includes("linkedin") ? "linkedin" : "cv",
          explanation: parsed.data.explanation,
          improvementSuggestions: parsed.data.suggestions,
        };

        // ── Anti-placeholder guard: reject if output matches mock fingerprint ──
        if (isMockSection(section)) {
          console.warn(
            `[guard] Mock fingerprint detected in scored section ${sectionId} (attempt ${attempt + 1}), retrying`
          );
          failureReasons.push("mock_fingerprint_retry");
          continue; // Force retry with different attempt message
        }

        return { section, modelUsed: result.modelUsed };
      }

      failureReasons.push("invalid_json");
      console.warn(
        `[diag] Audit parse failed: section=${sectionId}, attempt=${attempt + 1}, error=${parsed.error?.message}`
      );
    } catch (err) {
      const reason = categorizeError(err);
      failureReasons.push(reason);
      console.warn(
        `[diag] Audit LLM error: section=${sectionId}, attempt=${attempt + 1}, reason=${reason}, error=${err instanceof Error ? err.message : "Unknown"}`
      );
    }
  }

  return null; // will fall back to mock
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
  failureReasons: FailureReason[]
): Promise<{ rewrite: RewritePreview; modelUsed: string } | null> {
  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) {
    failureReasons.push("missing_prompt");
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

  for (let attempt = 0; attempt < 2; attempt++) {
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

      const jsonStr = extractJson(result.text);
      const parsed = RewriteSectionOutput.safeParse(JSON.parse(jsonStr));

      if (parsed.success) {
        const rewrite: RewritePreview = {
          sectionId,
          source: promptKey.includes("linkedin") ? "linkedin" : "cv",
          original: parsed.data.original,
          improvements: parsed.data.improvements,
          missingSuggestions: parsed.data.missingSuggestions,
          rewritten: parsed.data.rewritten,
          locked: false, // locking applied later
        };

        // ── Anti-placeholder guard: reject if rewrite matches mock fingerprint ──
        if (isMockRewrite(rewrite)) {
          console.warn(
            `[guard] Mock fingerprint detected in rewrite ${sectionId} (attempt ${attempt + 1}), retrying`
          );
          failureReasons.push("mock_fingerprint_retry");
          continue;
        }

        return { rewrite, modelUsed: result.modelUsed };
      }

      failureReasons.push("invalid_json");
      console.warn(
        `[diag] Rewrite parse failed: section=${sectionId}, attempt=${attempt + 1}, error=${parsed.error?.message}`
      );
    } catch (err) {
      const reason = categorizeError(err);
      failureReasons.push(reason);
      console.warn(
        `[diag] Rewrite LLM error: section=${sectionId}, attempt=${attempt + 1}, reason=${reason}, error=${err instanceof Error ? err.message : "Unknown"}`
      );
    }
  }

  return null;
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
      const parsed = CoverLetterOutput.safeParse(JSON.parse(jsonStr));

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

  // ─── 1. Parse input sections ──────────────────────────
  const linkedinSections = input.linkedinText.trim()
    ? await parseLinkedinSectionsWithFallback(input.linkedinText, locale)
    : {};

  const cvSections =
    input.cvText && input.cvText.trim().length > 20
      ? parseCvSections(input.cvText)
      : {};

  // ─── 2. Score LinkedIn sections (parallel) ────────────
  // Score ALL standard sections — missing ones get guidance content
  const hasLinkedinInput = input.linkedinText.trim().length > 0;
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
        failureReasons
      ).then((result) => ({ id, result }));
    }
  );

  // ─── 3. Score CV sections (parallel) ──────────────────
  // Score ALL standard CV sections when CV input exists — missing ones get guidance
  const hasCvInput = (input.cvText ?? "").trim().length > 20;
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
        failureReasons
      ).then((result) => ({ id, result }));
    }
  );

  const allScoreResults = await Promise.allSettled([
    ...linkedinScorePromises,
    ...cvScorePromises,
  ]);

  // ─── 4. Build scored sections with fallbacks ──────────
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
      // Fallback to mock data
      fallbackCount++;
      const id =
        settled.status === "fulfilled" ? settled.value.id : "unknown";
      console.warn(`[fallback] Using mock data for section: ${id}`);

      const mockLinkedin = mockResults.linkedinSections.find(
        (s) => s.id === id
      );
      const mockCv = mockResults.cvSections.find((s) => s.id === id);

      if (mockLinkedin) {
        scoredLinkedinSections.push({ ...mockLinkedin, locked: false });
      } else if (mockCv) {
        scoredCvSections.push({ ...mockCv, locked: false });
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
    // The fallback mock data fills gaps. This log helps diagnose issues.
  }

  // ─── 5. Rewrite sections (parallel) — one per scored section ──
  const linkedinRewritePromises = scoredLinkedinSections.map((section) => {
    const content = linkedinSections[section.id] ??
      `[This section was not found in the profile. The user has not included a ${SECTION_DISPLAY_NAMES[section.id] ?? section.id} section.]`;
    return rewriteSection(
      section.id,
      content,
      "rewrite.linkedin.section",
      targetRole,
      jobObjective,
      framing,
      locale,
      promptVersions,
      failureReasons
    ).then((result) => ({ id: section.id, result }));
  });

  const cvRewritePromises = scoredCvSections.map((section) => {
    const content = cvSections[section.id] ??
      `[This section was not found in the CV. The user has not included a ${SECTION_DISPLAY_NAMES[section.id] ?? section.id} section.]`;
    return rewriteSection(
      section.id,
      content,
      "rewrite.cv.section",
      targetRole,
      jobObjective,
      framing,
      locale,
      promptVersions,
      failureReasons
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
      fallbackCount++;
      const id =
        settled.status === "fulfilled" ? settled.value.id : "unknown";
      console.warn(`[fallback] Using mock rewrite for section: ${id}`);

      const mockLinkedin = mockResults.linkedinRewrites.find(
        (r) => r.sectionId === id
      );
      const mockCv = mockResults.cvRewrites.find(
        (r) => r.sectionId === id
      );

      if (mockLinkedin) {
        linkedinRewrites.push({ ...mockLinkedin, locked: false });
      } else if (mockCv) {
        cvRewrites.push({ ...mockCv, locked: false });
      }
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
      fallbackCount++;
      coverLetter = mockResults.coverLetter
        ? { ...mockResults.coverLetter, locked: false }
        : null;
    }
  }

  // ─── 7. Compute overall score ────────────────────────
  const allSections = [...scoredLinkedinSections, ...scoredCvSections];
  const overallScore = computeOverallScore(allSections);
  const overallTier = tierFromScore(overallScore);

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

  // ─── 9c. Compute degraded state (P0-2) ─────────────────
  const totalExpectedSections =
    (hasLinkedinInput ? LINKEDIN_SECTION_IDS.length : 0) +
    (hasCvInput ? CV_SECTION_IDS.length : 0);
  const degraded =
    totalExpectedSections > 0 &&
    fallbackCount / totalExpectedSections >= DEGRADED_FALLBACK_THRESHOLD;

  // Deduplicate failure reasons for client
  const uniqueFailureReasons = [...new Set(failureReasons)];

  // ─── 10. Integrity log (P0-1: structured diagnostics) ──
  console.log(
    `[diag] request=${requestId} | ` +
    `duration=${durationMs}ms | ` +
    `sections=${sectionCountGenerated} | ` +
    `rewrites=${linkedinRewrites.length + cvRewrites.length} | ` +
    `fallbacks=${fallbackCount} | ` +
    `mockLeaks=${mockLeaksDetected} | ` +
    `degraded=${degraded} | ` +
    `model=${primaryModel} | ` +
    `failureReasons=[${uniqueFailureReasons.join(",")}] | ` +
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
