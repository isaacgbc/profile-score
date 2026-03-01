import type { ExportModuleId, ExportFormat, ProfileResult } from "@/lib/types";
import { generateResultsSummaryPdf } from "./pdf/results-summary";
import { generateUpdatedCvPdf } from "./pdf/updated-cv";
import { generateFullAuditPdf } from "./pdf/full-audit";
import { generateLinkedinUpdatesPdf } from "./pdf/linkedin-updates";
import { generateCoverLetterPdf } from "./pdf/cover-letter";
import { generateUpdatedCvDocx } from "./docx/updated-cv-docx";
import { callLLM, LLM_MODEL_FAST } from "./llm-client";
import { getActivePromptWithVersion, interpolatePrompt } from "./prompt-resolver";
import { extractJson } from "@/lib/schemas/llm-output";
import { stripNonFlagEmojis } from "./generation-guards";
import { sanitizeTemplateOutput, countPlaceholders } from "@/lib/utils/placeholder-detect";
import type { Locale } from "@/lib/types";

interface GenerateResult {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}

/** Sanitized user input fields safe for export context */
export interface ExportUserInput {
  jobDescription?: string;
  targetAudience?: string;
  objectiveMode?: "job" | "objective";
  objectiveText?: string;
}

/**
 * Polish pass: refine rewritten content for export quality.
 * Falls back to emoji-stripped input if LLM polish fails.
 */
async function polishRewrittenContent(
  rewritten: string,
  objectiveContext: string,
  locale: Locale
): Promise<string> {
  // Don't polish very short content
  if (rewritten.length < 20) return stripNonFlagEmojis(rewritten);

  try {
    const prompt = await getActivePromptWithVersion(
      "export.polish-pass.system",
      locale
    );

    if (!prompt) {
      // No polish prompt available — just sanitize
      return stripNonFlagEmojis(rewritten);
    }

    const systemPrompt = interpolatePrompt(prompt.content, {
      rewritten_content: rewritten.slice(0, 10_000),
      objective_context: objectiveContext.slice(0, 1_000),
    });

    const result = await callLLM({
      model: LLM_MODEL_FAST,
      systemPrompt,
      userMessage:
        "Polish this content for professional export. Respond in JSON with key: polished.",
      maxTokens: 4096,
    });

    const jsonStr = extractJson(result.text);
    const parsed = JSON.parse(jsonStr);
    if (parsed.polished && typeof parsed.polished === "string" && parsed.polished.length > 10) {
      // Guard against LLM returning JSON-like content as polished text
      const trimmed = parsed.polished.trimStart();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return stripNonFlagEmojis(rewritten);
      }
      return stripNonFlagEmojis(parsed.polished);
    }
  } catch (err) {
    console.warn("[export-polish] Failed, using sanitized fallback:", err instanceof Error ? err.message : "Unknown");
  }

  return stripNonFlagEmojis(rewritten);
}

/**
 * Apply polish pass to all unlocked rewrites in results.
 */
async function applyPolishPass(
  results: ProfileResult,
  language: string,
  userInput?: ExportUserInput
): Promise<ProfileResult> {
  const locale = (language === "es" ? "es" : "en") as Locale;
  const objectiveContext = [
    userInput?.jobDescription ? `Target: ${userInput.jobDescription.slice(0, 300)}` : "",
    userInput?.targetAudience ? `Audience: ${userInput.targetAudience}` : "",
    userInput?.objectiveText ? `Goal: ${userInput.objectiveText}` : "",
  ]
    .filter(Boolean)
    .join(". ") || "Professional growth";

  // Polish a single rewrite (section-level + entry-level)
  async function polishRewrite(r: ProfileResult["linkedinRewrites"][number]) {
    if (r.locked) return r;
    const polished = await polishRewrittenContent(r.rewritten, objectiveContext, locale);

    // Polish entries within each rewrite (experience/education)
    const polishedEntries = r.entries
      ? await Promise.all(
          r.entries.map(async (entry) => ({
            ...entry,
            rewritten: await polishRewrittenContent(entry.rewritten, objectiveContext, locale),
          }))
        )
      : r.entries;

    return { ...r, rewritten: polished, entries: polishedEntries };
  }

  // Polish unlocked LinkedIn rewrites (parallel)
  const polishedLinkedin = await Promise.all(
    results.linkedinRewrites.map(polishRewrite)
  );

  // Polish unlocked CV rewrites (parallel)
  const polishedCv = await Promise.all(
    results.cvRewrites.map(polishRewrite)
  );

  return {
    ...results,
    linkedinRewrites: polishedLinkedin,
    cvRewrites: polishedCv,
  };
}

/**
 * Dispatch to the correct generator based on export type and format.
 */
export async function generateExport(
  exportType: ExportModuleId,
  format: ExportFormat,
  language: string,
  results: ProfileResult,
  userInput?: ExportUserInput
): Promise<GenerateResult> {
  // Apply polish pass to all rewrites before export generation
  const polishedResults = await applyPolishPass(results, language, userInput);

  // HOTFIX-9: Final sanitization pass — strip any remaining placeholders
  const sanitizedResults = sanitizeAllRewrites(polishedResults);

  // HOTFIX-9: Assert zero placeholders before export
  const totalPlaceholders = countAllPlaceholders(sanitizedResults);
  if (totalPlaceholders > 0) {
    console.error(
      `[EXPORT_HARD_STOP] ${totalPlaceholders} placeholders survived sanitization. ` +
      `Export proceeding with stripped output.`
    );
  }

  switch (exportType) {
    case "results-summary": {
      if (format !== "pdf") throw new Error("Results Summary only supports PDF format");
      const bytes = await generateResultsSummaryPdf(sanitizedResults, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "updated-cv": {
      if (format === "docx") {
        const bytes = await generateUpdatedCvDocx(sanitizedResults, language);
        return {
          bytes,
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ext: "docx",
        };
      }
      if (format !== "pdf") throw new Error("Updated CV only supports PDF and DOCX formats");
      const bytes = await generateUpdatedCvPdf(sanitizedResults, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "full-audit": {
      if (format !== "pdf") throw new Error("Full Audit only supports PDF format");
      const bytes = await generateFullAuditPdf(sanitizedResults, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "linkedin-updates": {
      if (format !== "pdf") throw new Error("LinkedIn Updates only supports PDF format");
      const bytes = await generateLinkedinUpdatesPdf(sanitizedResults, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "cover-letter": {
      if (format !== "pdf") throw new Error("Cover Letter only supports PDF format");
      const bytes = await generateCoverLetterPdf(sanitizedResults, language, userInput);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    default:
      throw new Error(`Unknown export type: ${exportType}`);
  }
}

/**
 * HOTFIX-9: Apply sanitizeTemplateOutput to ALL rewrite text before export.
 * Ensures no placeholder tokens survive to PDF/DOCX output.
 */
function sanitizeAllRewrites(results: ProfileResult): ProfileResult {
  const sanitize = (r: ProfileResult["linkedinRewrites"][number]) => ({
    ...r,
    rewritten: sanitizeTemplateOutput(r.rewritten),
    entries: r.entries?.map((e) => ({
      ...e,
      rewritten: sanitizeTemplateOutput(e.rewritten),
    })),
  });
  return {
    ...results,
    linkedinRewrites: results.linkedinRewrites.map(sanitize),
    cvRewrites: results.cvRewrites.map(sanitize),
  };
}

/**
 * HOTFIX-9: Count remaining placeholders across all rewrites.
 * Should be 0 after sanitizeAllRewrites.
 */
function countAllPlaceholders(results: ProfileResult): number {
  let total = 0;
  for (const r of [...results.linkedinRewrites, ...results.cvRewrites]) {
    total += countPlaceholders(r.rewritten);
    if (r.entries) {
      for (const e of r.entries) {
        total += countPlaceholders(e.rewritten);
      }
    }
  }
  return total;
}
