import type { ProfileResult } from "@/lib/types";

export function generateFullAuditJson(
  results: ProfileResult,
  language: string
): Uint8Array {
  const payload = {
    exportType: "full-audit",
    language,
    generatedAt: new Date().toISOString(),
    overallScore: results.overallScore,
    maxScore: results.maxScore,
    tier: results.tier,
    linkedinSections: results.linkedinSections.map((s) => ({
      id: s.id,
      source: s.source,
      score: s.score,
      maxScore: s.maxScore,
      tier: s.tier,
      explanation: s.explanation,
      improvementSuggestions: s.improvementSuggestions,
    })),
    cvSections: results.cvSections.map((s) => ({
      id: s.id,
      source: s.source,
      score: s.score,
      maxScore: s.maxScore,
      tier: s.tier,
      explanation: s.explanation,
      improvementSuggestions: s.improvementSuggestions,
    })),
  };

  return new TextEncoder().encode(JSON.stringify(payload, null, 2));
}
