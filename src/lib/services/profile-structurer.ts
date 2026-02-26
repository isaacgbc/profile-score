/**
 * LLM-based structuring pass for messy LinkedIn PDF text.
 *
 * Single Haiku call → StructuredProfileSchema JSON.
 * Gated behind ENABLE_STRUCTURING_PASS && isPdfSource.
 *
 * Cost controls:
 * - Input capped at 8,000 chars
 * - maxTokens: 3072
 * - 1 retry on invalid JSON (with stricter prompt)
 * - Returns null on any failure (soft fail)
 */

import { callLLM, LLM_MODEL_FAST } from "./llm-client";
import {
  StructuredProfileSchema,
  extractJson,
} from "@/lib/schemas/llm-output";
import type { StructuredProfileType } from "@/lib/schemas/llm-output";

const STRUCTURING_MAX_INPUT_CHARS = 8_000;
const STRUCTURING_MAX_TOKENS = 3_072;
const STRUCTURING_TIMEOUT_MS = 20_000;

const STRUCTURING_SYSTEM_PROMPT = `You are a LinkedIn profile structuring assistant. You receive messy text extracted from a LinkedIn PDF export and must structure it into clean JSON.

RULES:
- Extract ONLY these four sections: headline, about, experience, education
- Keep original text intact — do NOT summarize, paraphrase, or add content
- For experience entries: extract title, organization, dateRange, description
- For education entries: extract degree, institution, dateRange, details (optional)
- If a section is not present in the text, omit it from the JSON
- Maximum 10 experience entries and 6 education entries
- Do NOT invent or fabricate any information not present in the source text

Respond with ONLY valid JSON matching this schema:
{
  "headline": "string (optional)",
  "about": "string (optional)",
  "experience": [
    { "title": "string", "organization": "string", "dateRange": "string", "description": "string" }
  ],
  "education": [
    { "degree": "string", "institution": "string", "dateRange": "string", "details": "string (optional)" }
  ]
}`;

/**
 * Structure messy PDF text into clean JSON using a single Haiku call.
 * Returns null on any failure — caller falls back to regex parsing.
 */
export async function structureProfileText(
  rawText: string
): Promise<StructuredProfileType | null> {
  if (!rawText || rawText.trim().length < 50) return null;

  const truncated = rawText.slice(0, STRUCTURING_MAX_INPUT_CHARS);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        STRUCTURING_TIMEOUT_MS
      );

      const systemPrompt =
        attempt === 0
          ? STRUCTURING_SYSTEM_PROMPT
          : STRUCTURING_SYSTEM_PROMPT +
            "\n\nCRITICAL: Your previous response was not valid JSON. Respond ONLY with valid JSON, nothing else.";

      try {
        const result = await callLLM({
          model: LLM_MODEL_FAST,
          systemPrompt,
          userMessage: `Structure this LinkedIn PDF text into clean JSON:\n\n${truncated}`,
          maxTokens: STRUCTURING_MAX_TOKENS,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const jsonStr = extractJson(result.text);
        const parsed = JSON.parse(jsonStr);
        const validated = StructuredProfileSchema.safeParse(parsed);

        if (validated.success) {
          console.log(
            `[structurer] Success: attempt=${attempt + 1}, ` +
            `headline=${!!validated.data.headline}, ` +
            `about=${!!validated.data.about}, ` +
            `experience=${validated.data.experience?.length ?? 0}, ` +
            `education=${validated.data.education?.length ?? 0}`
          );
          return validated.data;
        }

        // Zod validation failed — retry with stricter prompt
        console.warn(
          `[structurer] Zod validation failed: attempt=${attempt + 1}, ` +
          `errors=${JSON.stringify(validated.error.flatten().fieldErrors)}`
        );
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[structurer] Error: attempt=${attempt + 1}, error=${msg.slice(0, 100)}`
      );
      // Only retry on invalid JSON, not on timeouts or other hard errors
      if (
        attempt === 0 &&
        (msg.includes("JSON") || msg.includes("json") || msg.includes("parse"))
      ) {
        continue;
      }
      break;
    }
  }

  return null; // Soft fail — caller falls back to regex
}

/**
 * Convert structured profile into section map compatible with linkedin-parser output.
 * This bridges the structurer output to the existing orchestrator pipeline.
 */
export function structuredProfileToSections(
  profile: StructuredProfileType
): Record<string, string> {
  const sections: Record<string, string> = {};

  if (profile.headline) {
    sections.headline = profile.headline;
  }

  if (profile.about) {
    sections.summary = profile.about;
  }

  if (profile.experience && profile.experience.length > 0) {
    const lines: string[] = [];
    for (const entry of profile.experience) {
      if (entry.title) lines.push(entry.title);
      if (entry.organization) lines.push(entry.organization);
      if (entry.dateRange) lines.push(entry.dateRange);
      if (entry.description) lines.push(entry.description);
      lines.push(""); // blank separator between entries
    }
    sections.experience = lines.join("\n").trim();
  }

  if (profile.education && profile.education.length > 0) {
    const lines: string[] = [];
    for (const entry of profile.education) {
      if (entry.degree) lines.push(entry.degree);
      if (entry.institution) lines.push(entry.institution);
      if (entry.dateRange) lines.push(entry.dateRange);
      if (entry.details) lines.push(entry.details);
      lines.push(""); // blank separator between entries
    }
    sections.education = lines.join("\n").trim();
  }

  return sections;
}
