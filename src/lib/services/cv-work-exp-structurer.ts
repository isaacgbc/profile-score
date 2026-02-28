/**
 * AI-assisted structuring for work experience entries.
 *
 * When heuristic confidence is low (bullets split as separate entries, etc.),
 * this module calls a fast LLM to re-structure the raw work experience text
 * into proper job entries.
 *
 * Works for both CV and LinkedIn experience sections.
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

const SYSTEM_PROMPT = `You are a CV/profile parser. You receive raw work experience text extracted from a CV/resume or LinkedIn profile and must structure it into clean JSON.

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
 * Structure raw work experience text into proper entries using AI.
 * Works for both CV and LinkedIn experience sections.
 * Returns null on any failure — caller falls back to heuristic parser.
 *
 * @param rawText - The raw section text to structure
 * @param source - "cv" or "linkedin" (used for diagnostics)
 */
export async function structureWorkExperience(
  rawText: string,
  source: "cv" | "linkedin" = "cv"
): Promise<ParsedEntry[] | null> {
  if (!rawText || rawText.trim().length < 50) return null;

  const truncated = rawText.slice(0, MAX_INPUT_CHARS);
  const logPrefix = source === "cv" ? "[cvWorkExpStructurer]" : "[linkedinExpStructurer]";

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
          userMessage: `Structure this ${source === "linkedin" ? "LinkedIn profile" : "CV"} work experience text into clean JSON entries. Each real job = one entry. Bullets stay under their job:\n\n${truncated}`,
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
              `${logPrefix} Success: attempt=${attempt + 1}, entries=${entries.length}`
            );
            return entries;
          }
        }

        console.warn(
          `${logPrefix} Invalid structure: attempt=${attempt + 1}, ` +
            `hasEntries=${!!parsed?.entries}, length=${parsed?.entries?.length ?? 0}`
        );
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `${logPrefix} Error: attempt=${attempt + 1}, error=${msg.slice(0, 100)}`
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

/**
 * Backward-compatible alias for CV work experience structuring.
 * @deprecated Use structureWorkExperience(rawText, "cv") instead.
 */
export async function structureCvWorkExperience(
  rawText: string
): Promise<ParsedEntry[] | null> {
  return structureWorkExperience(rawText, "cv");
}

// ──────────────────────────────────────────────────────────────────
// HOTFIX-5B: Lightweight pre-normalization for LinkedIn Experience
// ──────────────────────────────────────────────────────────────────

const PRENORM_TIMEOUT_MS = 10_000;
const PRENORM_MAX_TOKENS = 2_048;

const PRENORM_SYSTEM = `You are a text formatter. You receive raw LinkedIn experience text that may be messy (bullet fragments as separate entries, merged positions, missing labels).

Your task: reformat into clean labeled blocks. One block per real job position.

FORMAT (exactly this, no JSON):
---
Title: <job title>
Organization: <company name>
Date Range: <date range>
Description:
<all bullet points and body text for this job, preserving original wording>
---

RULES:
- One block per real job/position — never split bullets into separate blocks
- Bullet points belong under the SAME job they describe
- Keep original text INTACT — do NOT summarize, paraphrase, or invent content
- If title or organization is unclear, leave blank after the colon
- Maximum 10 blocks
- Preserve source order
- Use "---" as block separator`;

/**
 * HOTFIX-5B: Pre-normalize messy LinkedIn Experience text into clean labeled blocks.
 *
 * This is a LIGHTWEIGHT pass that reformats raw text into a deterministic format
 * that the heuristic parser can reliably parse. Unlike structureWorkExperience()
 * which returns JSON, this returns plain text with labeled blocks.
 *
 * Constraints:
 * - Single fast LLM call (Haiku)
 * - 10s timeout (faster than full structurer)
 * - Input capped at 6,000 chars
 * - Returns null on failure (caller uses raw text as-is)
 * - Does NOT invent content — only reformats
 */
export async function preNormalizeLinkedinExperience(
  rawText: string
): Promise<string | null> {
  if (!rawText || rawText.trim().length < 80) return null;

  const truncated = rawText.slice(0, MAX_INPUT_CHARS);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PRENORM_TIMEOUT_MS);

    try {
      const result = await callLLM({
        model: LLM_MODEL_FAST,
        systemPrompt: PRENORM_SYSTEM,
        userMessage: `Reformat this LinkedIn experience text into clean labeled blocks. One block per real job position. Keep original text intact:\n\n${truncated}`,
        maxTokens: PRENORM_MAX_TOKENS,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const normalized = result.text?.trim();
      if (!normalized || normalized.length < 30) {
        console.warn(`[preNormalize] Output too short (${normalized?.length ?? 0} chars), skipping`);
        return null;
      }

      // Sanity check: must contain at least one labeled block
      const hasLabels =
        /Title:/i.test(normalized) ||
        /Organization:/i.test(normalized) ||
        /Date Range:/i.test(normalized);

      if (!hasLabels) {
        console.warn(`[preNormalize] No labeled blocks found in output, skipping`);
        return null;
      }

      // Count blocks (--- separators or Title: labels)
      const blockCount = (normalized.match(/^Title:/gim) || []).length;
      console.log(
        `[preNormalize] Success: inputChars=${truncated.length}, outputChars=${normalized.length}, blocks=${blockCount}`
      );

      return normalized;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[preNormalize] Failed: ${msg.slice(0, 100)}`);
    return null;
  }
}
