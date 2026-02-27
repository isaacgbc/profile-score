import type { ExportModuleId, ExportFormat, ProfileResult } from "@/lib/types";
import { generateResultsSummaryPdf } from "./pdf/results-summary";
import { generateUpdatedCvPdf } from "./pdf/updated-cv";
import { generateFullAuditPdf } from "./pdf/full-audit";
import { generateLinkedinUpdatesPdf } from "./pdf/linkedin-updates";
import { generateCoverLetterPdf } from "./pdf/cover-letter";
import { callLLM, LLM_MODEL_FAST } from "./llm-client";
import { getActivePromptWithVersion, interpolatePrompt } from "./prompt-resolver";
import { extractJson } from "@/lib/schemas/llm-output";
import { stripNonFlagEmojis } from "./generation-guards";
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

  switch (exportType) {
    case "results-summary": {
      if (format !== "pdf") throw new Error("Results Summary only supports PDF format");
      const bytes = await generateResultsSummaryPdf(polishedResults, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "updated-cv": {
      if (format !== "pdf") throw new Error("Updated CV only supports PDF format");
      const bytes = await generateUpdatedCvPdf(polishedResults, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "full-audit": {
      if (format !== "pdf") throw new Error("Full Audit only supports PDF format");
      const bytes = await generateFullAuditPdf(polishedResults, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "linkedin-updates": {
      if (format !== "pdf") throw new Error("LinkedIn Updates only supports PDF format");
      const bytes = await generateLinkedinUpdatesPdf(polishedResults, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "cover-letter": {
      if (format !== "pdf") throw new Error("Cover Letter only supports PDF format");
      const bytes = await generateCoverLetterPdf(polishedResults, language, userInput);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    default:
      throw new Error(`Unknown export type: ${exportType}`);
  }
}
