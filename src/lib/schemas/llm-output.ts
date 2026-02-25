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

// ── Rewrite section output ──
// Matches RewritePreview interface
export const RewriteSectionOutput = z.object({
  original: z.string(),
  improvements: z.string().min(10).max(1000),
  missingSuggestions: z.array(z.string()).min(1).max(6),
  rewritten: z.string().min(10),
});

export type RewriteSectionOutputType = z.infer<typeof RewriteSectionOutput>;

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
