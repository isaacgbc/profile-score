import type { ProfileResult, Locale } from "@/lib/types";
import type { ExportUserInput } from "@/lib/services/export-generator";
import { getActivePrompt, interpolatePrompt } from "@/lib/services/prompt-resolver";

export async function generateCoverLetterJson(
  results: ProfileResult,
  language: string,
  userInput?: ExportUserInput
): Promise<Uint8Array> {
  // Resolve system prompt for cover letter from registry
  const systemPrompt = await getActivePrompt(
    "export.cover-letter.system",
    language as Locale
  );

  // Derive target role from userInput (real data) or fallback
  const targetRole = userInput?.jobDescription
    ? userInput.jobDescription.split("\n")[0].trim().slice(0, 150)
    : "Professional";

  const jobObjective =
    userInput?.objectiveMode === "objective"
      ? userInput.objectiveText ?? ""
      : userInput?.jobDescription ?? "";

  // Include strengths from all available sources (source-aware scope)
  const allSections = [...results.linkedinSections, ...results.cvSections];
  const keyStrengths = allSections
    .filter((s) => s.tier === "excellent" || s.tier === "good")
    .map((s) => s.id)
    .join(", ");

  // Build objective framing for v2 prompts
  const objectiveFraming =
    userInput?.objectiveMode === "objective"
      ? `Optimize for the stated objective: ${(userInput.objectiveText ?? "").slice(0, 200)}`
      : "Optimize for recruiter visibility, ATS compatibility, and job-market competitiveness";
  const objectiveModeLabel =
    userInput?.objectiveMode === "objective" ? "Objective" : "Target role";
  const objectiveContext =
    userInput?.objectiveMode === "objective"
      ? userInput.objectiveText ?? ""
      : userInput?.jobDescription ?? targetRole;

  const interpolated = systemPrompt
    ? interpolatePrompt(systemPrompt, {
        target_role: targetRole,
        job_objective: jobObjective,
        key_strengths: keyStrengths || "General professional strengths",
        overall_score: String(results.overallScore),
        objective_mode_label: objectiveModeLabel,
        objective_framing: objectiveFraming,
        objective_context: objectiveContext,
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
