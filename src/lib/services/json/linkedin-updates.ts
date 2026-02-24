import type { ProfileResult, Locale } from "@/lib/types";
import { getActivePrompt } from "@/lib/services/prompt-resolver";

export async function generateLinkedinUpdatesJson(
  results: ProfileResult,
  language: string
): Promise<Uint8Array> {
  // Resolve rewrite instruction prompt from registry
  const rewritePrompt = await getActivePrompt(
    "rewrite.linkedin.section",
    language as Locale
  );

  const payload = {
    exportType: "linkedin-updates",
    language,
    generatedAt: new Date().toISOString(),
    rewriteInstruction: rewritePrompt ?? null,
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
