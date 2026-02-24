/**
 * Maps raw section IDs from mock data to human-readable i18n keys.
 * Used consistently across ScoreCardGrid, RewriteCard, and Rewrite Studio.
 */

const SECTION_LABEL_MAP: Record<string, string> = {
  // LinkedIn sections
  headline: "headline",
  summary: "summary",
  experience: "experience",
  skills: "skills",
  education: "education",
  recommendations: "recommendations",
  // CV sections (kebab-case IDs → camelCase i18n keys)
  "contact-info": "contactInfo",
  "professional-summary": "professionalSummary",
  "work-experience": "workExperience",
  "skills-section": "skillsSection",
  "education-section": "educationSection",
  certifications: "certifications",
};

/**
 * Returns a human-readable label for a section ID.
 * @param sectionId - The raw section ID (e.g. "professional-summary")
 * @param labels - The i18n labels object (e.g. t.sectionLabels)
 * @returns Human-readable label (e.g. "Professional Summary")
 */
export function getSectionLabel(
  sectionId: string,
  labels: Record<string, string>
): string {
  const key = SECTION_LABEL_MAP[sectionId];
  if (key && labels[key]) return labels[key];
  // Fallback: convert kebab-case to Title Case
  return sectionId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
