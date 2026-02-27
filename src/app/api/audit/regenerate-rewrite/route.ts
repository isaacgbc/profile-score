import { NextResponse } from "next/server";
import { z } from "zod";
import { callLLM, LLM_MODEL_QUALITY } from "@/lib/services/llm-client";
import {
  getActivePromptWithVersion,
  interpolatePrompt,
} from "@/lib/services/prompt-resolver";
import { RegenerateRewriteOutput, extractJson } from "@/lib/schemas/llm-output";
import { stripNonFlagEmojis } from "@/lib/services/generation-guards";
import { regenerateRateLimiter } from "@/lib/services/rate-limiter";
import { SECTION_DISPLAY_NAMES } from "@/lib/services/linkedin-parser";
import type { Locale } from "@/lib/types";

const VALID_SOURCES = ["linkedin", "cv"] as const;
const VALID_SECTION_IDS = new Set([
  "headline", "summary", "experience", "skills", "education", "recommendations",
  "featured", "certifications", "projects", "volunteer", "honors", "publications",
  "contact-info", "professional-summary", "work-experience", "skills-section",
  "education-section",
]);

const RegenerateInput = z.object({
  sectionId: z.string().min(1).max(100),
  source: z.enum(VALID_SOURCES),
  originalContent: z.string().min(10).max(15_000),
  editedImprovements: z.string().min(5).max(5_000),
  objectiveContext: z.string().max(2_000).optional(),
  locale: z.enum(["en", "es"]).optional(),
  /** HOTFIX-3: Manual content for sections missing from parsed input */
  manualContent: z.string().max(10_000).optional(),
});

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rateCheck = regenerateRateLimiter.check(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: rateCheck.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfter ?? 60) },
        }
      );
    }

    const body = await request.json();
    const parsed = RegenerateInput.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      sectionId,
      source,
      originalContent,
      editedImprovements,
      objectiveContext,
      locale: inputLocale,
      manualContent,
    } = parsed.data;

    const locale: Locale = inputLocale ?? "en";

    // Validate section ID
    if (!VALID_SECTION_IDS.has(sectionId)) {
      return NextResponse.json(
        { error: "Invalid sectionId" },
        { status: 400 }
      );
    }

    // Resolve the regenerate prompt
    const prompt = await getActivePromptWithVersion(
      "rewrite.regenerate.system",
      locale
    );
    if (!prompt) {
      return NextResponse.json(
        { error: "Regeneration prompt not available" },
        { status: 503 }
      );
    }

    const sectionName = SECTION_DISPLAY_NAMES[sectionId] ?? sectionId;

    // HOTFIX-3: Use manualContent as original_content when provided (missing section recovery)
    const effectiveOriginal = manualContent?.trim()
      ? manualContent.trim()
      : originalContent;

    const systemPrompt = interpolatePrompt(prompt.content, {
      section_name: sectionName,
      source_type: source,
      original_content: effectiveOriginal.slice(0, 10_000),
      editing_directives: editedImprovements.slice(0, 3_000),
      objective_context: objectiveContext?.slice(0, 1_500) ?? "Professional growth",
    });

    // HOTFIX-2: Explicit language instruction for non-English locales
    const langInstruction = locale !== "en"
      ? " ALL output text MUST be in Spanish."
      : "";

    // LLM call with one retry
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await callLLM({
          model: LLM_MODEL_QUALITY,
          systemPrompt:
            attempt === 0
              ? systemPrompt
              : systemPrompt + "\n\nIMPORTANT: Respond with ONLY valid JSON.",
          userMessage:
            attempt === 0
              ? `Rewrite the ${sectionName} section incorporating the user's editing directives. Respond in JSON with key: rewritten.${langInstruction}`
              : `Your previous response was not valid JSON. Respond with ONLY valid JSON with key: rewritten.${langInstruction}`,
          maxTokens: 4096,
        });

        const jsonStr = extractJson(result.text);
        const parsedOutput = RegenerateRewriteOutput.safeParse(
          JSON.parse(jsonStr)
        );

        if (parsedOutput.success) {
          const rewritten = stripNonFlagEmojis(parsedOutput.data.rewritten);
          return NextResponse.json({ rewritten });
        }
      } catch (err) {
        console.warn(
          `[regenerate] LLM error: section=${sectionId}, attempt=${attempt + 1}, error=${err instanceof Error ? err.message : "Unknown"}`
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to regenerate rewrite" },
      { status: 500 }
    );
  } catch (err) {
    console.error("POST /api/audit/regenerate-rewrite error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
