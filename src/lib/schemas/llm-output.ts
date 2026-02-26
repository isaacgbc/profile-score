import { z } from "zod";
import type { ScoreTier } from "@/lib/types";

// ── Audit section output ──
// Matches ScoreSection interface after tier normalization
export const AuditSectionOutput = z.object({
  score: z.number().min(0).max(100),
  tier: z.enum(["excellent", "good", "needs-work", "fair", "poor"]),
  explanation: z.string().min(10).max(2000),
  suggestions: z.array(z.string().min(5).max(500)).min(1).max(5),
});

export type AuditSectionOutputType = z.infer<typeof AuditSectionOutput>;

// ── PR2C: Normalize raw LLM audit output before Zod validation ──
// Prevents invalid_json from oversized suggestions that exceed schema limits.
// Returns { normalized: true, data } when truncation was applied, { normalized: false, data } otherwise.
const SUGGESTION_HARD_CAP_CHARS = 400;
const SUGGESTION_MAX_COUNT = 5;

export function normalizeAuditOutput(raw: unknown): {
  normalized: boolean;
  data: unknown;
} {
  if (!raw || typeof raw !== "object") return { normalized: false, data: raw };

  const obj = raw as Record<string, unknown>;
  let didNormalize = false;

  // Normalize suggestions array
  if (Array.isArray(obj.suggestions)) {
    let suggestions = obj.suggestions as unknown[];

    // Remove empty/whitespace-only items
    const before = suggestions.length;
    suggestions = suggestions.filter(
      (s) => typeof s === "string" && s.trim().length > 0
    );
    if (suggestions.length !== before) didNormalize = true;

    // Deduplicate (case-insensitive)
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const s of suggestions as string[]) {
      const key = s.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(s);
      } else {
        didNormalize = true;
      }
    }
    suggestions = deduped;

    // Trim each suggestion to hard cap
    suggestions = (suggestions as string[]).map((s) => {
      if (s.length > SUGGESTION_HARD_CAP_CHARS) {
        didNormalize = true;
        // Trim at last sentence boundary within cap, or hard-cut
        const trimmed = s.slice(0, SUGGESTION_HARD_CAP_CHARS);
        const lastPeriod = trimmed.lastIndexOf(".");
        return lastPeriod > SUGGESTION_HARD_CAP_CHARS * 0.5
          ? trimmed.slice(0, lastPeriod + 1)
          : trimmed.trimEnd() + "…";
      }
      return s;
    });

    // Cap count
    if (suggestions.length > SUGGESTION_MAX_COUNT) {
      suggestions = suggestions.slice(0, SUGGESTION_MAX_COUNT);
      didNormalize = true;
    }

    obj.suggestions = suggestions;
  }

  // Trim explanation if over 2000 chars
  if (typeof obj.explanation === "string" && obj.explanation.length > 2000) {
    const trimmed = obj.explanation.slice(0, 2000);
    const lastPeriod = trimmed.lastIndexOf(".");
    obj.explanation =
      lastPeriod > 1500
        ? trimmed.slice(0, lastPeriod + 1)
        : trimmed.trimEnd();
    didNormalize = true;
  }

  return { normalized: didNormalize, data: obj };
}

// ── Rewrite section output ──
// Matches RewritePreview interface
export const RewriteSectionOutput = z.object({
  original: z.string(),
  improvements: z.string().min(10).max(1000),
  missingSuggestions: z.array(z.string()).min(1).max(6),
  rewritten: z.string().min(10),
});

export type RewriteSectionOutputType = z.infer<typeof RewriteSectionOutput>;

// ── Per-entry rewrite output (experience/education) ──
export const RewriteEntryOutput = z.object({
  entryTitle: z.string().min(3).max(200),
  original: z.string(),
  improvements: z.string().min(5).max(500),
  missingSuggestions: z.array(z.string()).min(0).max(4),
  rewritten: z.string().min(10),
});

export const RewriteSectionWithEntriesOutput = z.object({
  original: z.string(),
  improvements: z.string().min(10).max(1000),
  missingSuggestions: z.array(z.string()).min(1).max(6),
  rewritten: z.string().min(10),
  entries: z.array(RewriteEntryOutput).optional(),
});

export type RewriteEntryOutputType = z.infer<typeof RewriteEntryOutput>;
export type RewriteSectionWithEntriesOutputType = z.infer<
  typeof RewriteSectionWithEntriesOutput
>;

// ── Overall descriptor output ──
export const OverallDescriptorOutput = z.object({
  descriptor: z.string().min(20).max(2000),
});

export type OverallDescriptorOutputType = z.infer<typeof OverallDescriptorOutput>;

// ── Regenerate rewrite output ──
export const RegenerateRewriteOutput = z.object({
  rewritten: z.string().min(10),
});

export type RegenerateRewriteOutputType = z.infer<typeof RegenerateRewriteOutput>;

// ── Cover letter output ──
export const CoverLetterOutput = z.object({
  content: z.string().min(50).max(5000),
});

export type CoverLetterOutputType = z.infer<typeof CoverLetterOutput>;

// ── Tier normalization ──
// Seed prompts use "needs-work" but app type uses "fair"
const TIER_MAP: Record<string, ScoreTier> = {
  excellent: "excellent",
  good: "good",
  "needs-work": "fair",
  fair: "fair",
  poor: "poor",
};

export function normalizeTier(raw: string): ScoreTier {
  return TIER_MAP[raw] ?? "fair";
}

/**
 * Derive overall tier from numeric score.
 */
export function tierFromScore(score: number): ScoreTier {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "fair";
  return "poor";
}

/**
 * Attempt to extract JSON from an LLM response.
 * Handles responses wrapped in markdown code blocks.
 */
export function extractJson(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a JSON object or array
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) return jsonMatch[1];

  return text.trim();
}
