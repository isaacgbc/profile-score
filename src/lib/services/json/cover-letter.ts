import type { ProfileResult } from "@/lib/types";

export function generateCoverLetterJson(
  results: ProfileResult,
  language: string
): Uint8Array {
  const payload = {
    exportType: "cover-letter",
    language,
    generatedAt: new Date().toISOString(),
    content: results.coverLetter?.content ?? "",
  };

  return new TextEncoder().encode(JSON.stringify(payload, null, 2));
}
