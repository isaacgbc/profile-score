/**
 * HOTFIX-CV-EXPERIENCE-PARSING: AI-assisted structuring for CV work experience.
 *
 * When heuristic confidence is low (bullets split as separate entries, etc.),
 * this module calls a fast LLM to re-structure the raw work experience text
 * into proper job entries.
 *
 * Constraints:
 * - Single Haiku call (cost-efficient)
 * - Input capped at 6,000 chars
 * - Returns null on failure (soft fail → caller uses merge-guarded heuristic)
 * - Preserves source order and does NOT invent content
 */

import { callLLM, LLM_MODEL_FAST } from "./llm-client";
import { extractJson } from "@/lib/schemas/llm-output";
import type { ParsedEntry } from "./linkedin-parser";

const MAX_INPUT_CHARS = 6_000;
const MAX_TOKENS = 2_048;
const TIMEOUT_MS = 15_000;

const SYSTEM_PROMPT = `You are a CV parser. You receive raw work experience text extracted from a CV/resume and must structure it into clean JSON.

RULES:
- Each array element = ONE real job/position. Never split bullet points into separate jobs.
- Bullet points (lines starting with -, *, •) belong to the SAME job they appear under.
- Extract: organization (company name), title (job title/role), dateRange, description (all bullet points and body text for that job, joined with newlines)
- Keep original text intact — do NOT summarize, paraphrase, or add content
- Maximum 10 entries
- Preserve the order from the source text
- If you can't determine organization or title, use empty string

Respond with ONLY valid JSON:
{
  "entries": [
    {
      "organization": "Company Name",
      "title": "Job Title",
      "dateRange": "Jan 2020 - Present",
      "description": "- bullet 1\\n- bullet 2\\n- bullet 3"
    }
  ]
}`;

interface StructuredWorkExpEntry {
  organization: string;
  title: string;
  dateRange: string;
  description: string;
}

/**
 * Structure raw CV work experience text into proper entries using AI.
 * Returns null on any failure — caller falls back to heuristic parser.
 */
export async function structureCvWorkExperience(
  rawText: string
): Promise<ParsedEntry[] | null> {
  if (!rawText || rawText.trim().length < 50) return null;

  const truncated = rawText.slice(0, MAX_INPUT_CHARS);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const systemPrompt =
        attempt === 0
          ? SYSTEM_PROMPT
          : SYSTEM_PROMPT +
            "\n\nCRITICAL: Your previous response was not valid JSON. Respond ONLY with valid JSON.";

      try {
        const result = await callLLM({
          model: LLM_MODEL_FAST,
          systemPrompt,
          userMessage: `Structure this CV work experience text into clean JSON entries. Each real job = one entry. Bullets stay under their job:\n\n${truncated}`,
          maxTokens: MAX_TOKENS,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const jsonStr = extractJson(result.text);
        const parsed = JSON.parse(jsonStr);

        if (
          parsed &&
          Array.isArray(parsed.entries) &&
          parsed.entries.length > 0
        ) {
          const entries: ParsedEntry[] = (
            parsed.entries as StructuredWorkExpEntry[]
          )
            .filter(
              (e) => e.organization || e.title || e.description || e.dateRange
            )
            .slice(0, 10)
            .map((e) => ({
              title: (e.title || "").trim(),
              organization: (e.organization || "").trim(),
              dateRange: (e.dateRange || "").trim(),
              description: (e.description || "").trim(),
            }));

          if (entries.length > 0) {
            console.log(
              `[cvWorkExpStructurer] Success: attempt=${attempt + 1}, entries=${entries.length}`
            );
            return entries;
          }
        }

        console.warn(
          `[cvWorkExpStructurer] Invalid structure: attempt=${attempt + 1}, ` +
            `hasEntries=${!!parsed?.entries}, length=${parsed?.entries?.length ?? 0}`
        );
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[cvWorkExpStructurer] Error: attempt=${attempt + 1}, error=${msg.slice(0, 100)}`
      );
      // Only retry on JSON parse errors
      if (
        attempt === 0 &&
        (msg.includes("JSON") || msg.includes("json") || msg.includes("parse"))
      ) {
        continue;
      }
      break;
    }
  }

  return null; // Soft fail → caller uses heuristic output
}
