import type { ProfileResult } from "@/lib/types";

export function generateLinkedinUpdatesJson(
  results: ProfileResult,
  language: string
): Uint8Array {
  const payload = {
    exportType: "linkedin-updates",
    language,
    generatedAt: new Date().toISOString(),
    sections: results.linkedinRewrites.map((r) => ({
      sectionId: r.sectionId,
      source: r.source,
      original: r.original,
      rewritten: r.rewritten,
      improvements: r.improvements,
    })),
  };

  return new TextEncoder().encode(JSON.stringify(payload, null, 2));
}
