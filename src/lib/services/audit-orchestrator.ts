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
}

// ── Generation metadata ─────────────────────────────────
export interface GenerationMeta {
  modelUsed: string;
  promptVersionsUsed: Record<string, number>;
  durationMs: number;
  fallbackCount: number;
  hasFallback: boolean;
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

// ── Objective framing for prompts (Fix #1) ──────────────
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
  promptVersions: Record<string, number>
): Promise<{ section: ScoreSection; modelUsed: string } | null> {
  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) return null;

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
        return {
          section: {
            id: sectionId,
            score: parsed.data.score,
            maxScore: 100,
            tier: normalizeTier(parsed.data.tier),
            locked: false, // locking applied later
            source: promptKey.includes("linkedin") ? "linkedin" : "cv",
            explanation: parsed.data.explanation,
            improvementSuggestions: parsed.data.suggestions,
          },
          modelUsed: result.modelUsed,
        };
      }

      console.warn(
        `Audit parse failed for ${sectionId} (attempt ${attempt + 1}):`,
        parsed.error?.message
      );
    } catch (err) {
      console.warn(
        `Audit LLM error for ${sectionId} (attempt ${attempt + 1}):`,
        err instanceof Error ? err.message : "Unknown"
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
  promptVersions: Record<string, number>
): Promise<{ rewrite: RewritePreview; modelUsed: string } | null> {
  const prompt = await getActivePromptWithVersion(promptKey, locale);
  if (!prompt) return null;

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
        return {
          rewrite: {
            sectionId,
            source: promptKey.includes("linkedin") ? "linkedin" : "cv",
            original: parsed.data.original,
            improvements: parsed.data.improvements,
            missingSuggestions: parsed.data.missingSuggestions,
            rewritten: parsed.data.rewritten,
            locked: false, // locking applied later
          },
          modelUsed: result.modelUsed,
        };
      }

      console.warn(
        `Rewrite parse failed for ${sectionId} (attempt ${attempt + 1}):`,
        parsed.error?.message
      );
    } catch (err) {
      console.warn(
        `Rewrite LLM error for ${sectionId} (attempt ${attempt + 1}):`,
        err instanceof Error ? err.message : "Unknown"
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
  promptVersions: Record<string, number>
): Promise<{ coverLetter: CoverLetterResult; modelUsed: string } | null> {
  const prompt = await getActivePromptWithVersion(
    "export.cover-letter.system",
    locale
  );
  if (!prompt) return null;

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
        return {
          coverLetter: {
            content: parsed.data.content,
            locked: false,
          },
          modelUsed: result.modelUsed,
        };
      }
    } catch (err) {
      console.warn(
        `Cover letter error (attempt ${attempt + 1}):`,
        err instanceof Error ? err.message : "Unknown"
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
  const startTime = Date.now();
  const promptVersions: Record<string, number> = {};
  let fallbackCount = 0;
  let primaryModel = LLM_MODEL_FAST;

  const targetRole = getTargetRole(input);
  const jobObjective =
    input.objectiveMode === "job"
      ? input.jobDescription
      : input.objectiveText;
  const framing = getObjectiveFraming(input);

  // ─── 0. Check DB cache ────────────────────────────────
  try {
    const inputHash = await computeInputHash({
      linkedinText: input.linkedinText,
      cvText: input.cvText,
      jobDescription: input.jobDescription,
      locale,
    });

    const cached = await getCachedResult(inputHash);
    if (cached) {
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
        },
      };
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
        promptVersions
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
        promptVersions
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
      console.warn(`Falling back to mock for section: ${id}`);

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

  // ─── 5. Rewrite sections (parallel) ──────────────────
  const linkedinRewritePromises = scoredLinkedinSections.map((section) => {
    const content = linkedinSections[section.id] ?? section.explanation;
    return rewriteSection(
      section.id,
      content,
      "rewrite.linkedin.section",
      targetRole,
      jobObjective,
      framing,
      locale,
      promptVersions
    ).then((result) => ({ id: section.id, result }));
  });

  const cvRewritePromises = scoredCvSections.map((section) => {
    const content = cvSections[section.id] ?? section.explanation;
    return rewriteSection(
      section.id,
      content,
      "rewrite.cv.section",
      targetRole,
      jobObjective,
      framing,
      locale,
      promptVersions
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
      console.warn(`Falling back to mock rewrite for section: ${id}`);

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
      promptVersions
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

  const durationMs = Date.now() - startTime;
  console.log(
    `Audit generation complete: ${durationMs}ms, ${allSections.length} sections, ${fallbackCount} fallbacks`
  );

  // ─── 10. Track analytics events (fire-and-forget) ─────
  trackServerEvent("llm_audit_generated", {
    metadata: {
      durationMs,
      sectionCount: allSections.length,
      model: primaryModel,
      fallbackCount,
      locale,
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

  // ─── 11. Store in DB cache (fire-and-forget) ──────────
  // Only cache when ALL sections were real LLM results (no fallbacks)
  if (fallbackCount === 0) {
    computeInputHash({
      linkedinText: input.linkedinText,
      cvText: input.cvText,
      jobDescription: input.jobDescription,
      locale,
    })
      .then((hash) =>
        setCachedResult(hash, results, primaryModel, promptVersions)
      )
      .catch(() => {}); // Cache writes must never break flow
  }

  return {
    results,
    meta: {
      modelUsed: primaryModel,
      promptVersionsUsed: promptVersions,
      durationMs,
      fallbackCount,
      hasFallback: fallbackCount > 0,
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
