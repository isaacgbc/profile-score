import type { ProfileResult, Locale } from "@/lib/types";
import { getActivePrompt, interpolatePrompt } from "@/lib/services/prompt-resolver";

export async function generateCoverLetterJson(
  results: ProfileResult,
  language: string
): Promise<Uint8Array> {
  // Resolve system prompt for cover letter from registry
  const systemPrompt = await getActivePrompt(
    "export.cover-letter.system",
    language as Locale
  );

  const interpolated = systemPrompt
    ? interpolatePrompt(systemPrompt, {
        target_role: "Professional", // Placeholder — would come from user input in production
        job_objective: "",
        key_strengths: results.linkedinSections
          .filter((s) => s.tier === "excellent" || s.tier === "good")
          .map((s) => s.id)
          .join(", "),
        overall_score: String(results.overallScore),
      })
    : null;

  const payload = {
    exportType: "cover-letter",
    language,
    generatedAt: new Date().toISOString(),
    systemPrompt: interpolated,
    content: results.coverLetter?.content ?? "",
  };

  return new TextEncoder().encode(JSON.stringify(payload, null, 2));
}
