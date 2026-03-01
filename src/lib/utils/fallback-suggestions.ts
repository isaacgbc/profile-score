/**
 * HOTFIX-9: Deterministic fallback suggestions per section.
 *
 * When the LLM returns empty missingSuggestions (passthrough fallback,
 * parse failure, etc.), these defaults ensure the instruction seeds area
 * in the Studio is never blank.
 *
 * Each section has exactly 3 actionable bullets.
 */

export const FALLBACK_SUGGESTIONS: Record<string, string[]> = {
  // LinkedIn sections
  headline: [
    "Add your target role or specialty",
    "Include years of experience",
    "Mention key industry or domain",
  ],
  summary: [
    "Add quantifiable achievements",
    "Mention leadership scope",
    "Include domain expertise",
  ],
  // HOTFIX-9d: "about" is an alias for "summary" — some code paths use either ID
  about: [
    "Add quantifiable achievements",
    "Mention leadership scope",
    "Include domain expertise",
  ],
  experience: [
    "Add measurable metrics (%, $, team size)",
    "Include technologies used",
    "Describe business impact",
  ],
  education: [
    "Add relevant coursework or honors",
    "Include GPA if above 3.5",
    "Mention extracurricular leadership",
  ],
  skills: [
    "Group skills by category",
    "Add proficiency levels",
    "Include emerging technologies",
  ],
  featured: [
    "Add links to published work",
    "Include project outcomes",
    "Mention media appearances",
  ],
  recommendations: [
    "Request recommendations from managers",
    "Ask for skill-specific endorsements",
    "Include cross-functional references",
  ],
  certifications: [
    "Add certification dates",
    "Include issuing organizations",
    "List relevant continuing education",
  ],

  // CV sections
  "contact-info": [
    "Ensure email is professional",
    "Add LinkedIn URL",
    "Include location",
  ],
  "professional-summary": [
    "Add quantifiable achievements",
    "Mention leadership scope",
    "Include domain expertise",
  ],
  "work-experience": [
    "Add measurable metrics (%, $, team size)",
    "Include technologies used",
    "Describe business impact",
  ],
  "skills-section": [
    "Group skills by category",
    "Add proficiency levels",
    "Include emerging technologies",
  ],
  "education-section": [
    "Add relevant coursework or honors",
    "Include GPA if above 3.5",
    "Mention extracurricular leadership",
  ],
};

/**
 * Returns 3 deterministic fallback suggestions for the given sectionId.
 * Falls back to generic suggestions if sectionId is unknown.
 */
export function getFallbackSuggestions(sectionId: string): string[] {
  return (
    FALLBACK_SUGGESTIONS[sectionId] ?? [
      "Add specific details",
      "Include measurable outcomes",
      "Mention relevant context",
    ]
  );
}
