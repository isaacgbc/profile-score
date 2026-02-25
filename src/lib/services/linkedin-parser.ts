/**
 * Parse raw LinkedIn profile text into named sections.
 *
 * The input is typically pasted text from a LinkedIn profile page, with
 * section headers like "About", "Experience", "Education", "Skills".
 *
 * Returns a Record mapping section IDs to their text content.
 * Missing sections are simply omitted from the result.
 */

// Section header patterns → internal IDs
const SECTION_HEADERS: { pattern: RegExp; id: string }[] = [
  { pattern: /^about$/i, id: "summary" },
  { pattern: /^experience$/i, id: "experience" },
  { pattern: /^education$/i, id: "education" },
  { pattern: /^skills(?:\s+&\s+endorsements)?$/i, id: "skills" },
  { pattern: /^recommendations$/i, id: "recommendations" },
  { pattern: /^licenses?\s*&?\s*certifications?$/i, id: "certifications" },
  { pattern: /^volunteer(?:\s+experience)?$/i, id: "volunteer" },
  { pattern: /^projects?$/i, id: "projects" },
  { pattern: /^publications?$/i, id: "publications" },
  { pattern: /^honors?\s*&?\s*awards?$/i, id: "honors" },
];

/**
 * Match a line against known section headers.
 * Returns the section ID or null if no match.
 */
function matchHeader(line: string): string | null {
  const trimmed = line.trim();
  for (const { pattern, id } of SECTION_HEADERS) {
    if (pattern.test(trimmed)) return id;
  }
  return null;
}

export interface ParsedLinkedinSections {
  headline: string;
  [sectionId: string]: string;
}

export function parseLinkedinSections(
  rawText: string
): Record<string, string> {
  const lines = rawText.split("\n");
  const sections: Record<string, string> = {};

  if (lines.length === 0) return sections;

  // First non-empty line is treated as the headline
  let lineIndex = 0;
  while (lineIndex < lines.length && lines[lineIndex].trim() === "") {
    lineIndex++;
  }

  if (lineIndex < lines.length) {
    const firstLine = lines[lineIndex].trim();
    // Only use as headline if it's not a known section header
    if (!matchHeader(firstLine)) {
      sections.headline = firstLine;
      lineIndex++;
    }
  }

  // Walk remaining lines, grouping by section headers
  let currentSection: string | null = null;
  let currentLines: string[] = [];

  function flushSection() {
    if (currentSection && currentLines.length > 0) {
      const content = currentLines.join("\n").trim();
      if (content.length > 0) {
        sections[currentSection] = content;
      }
    }
    currentLines = [];
  }

  for (; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const headerId = matchHeader(line);

    if (headerId) {
      flushSection();
      currentSection = headerId;
    } else if (currentSection) {
      currentLines.push(line);
    } else {
      // Lines before the first section header — append to headline context
      // or treat as unstructured intro
      if (sections.headline && line.trim()) {
        sections.headline += "\n" + line.trim();
      }
    }
  }

  // Flush last section
  flushSection();

  return sections;
}

/**
 * Standard LinkedIn sections IDs used in the audit flow.
 * The orchestrator iterates over these to score and rewrite.
 */
export const LINKEDIN_SECTION_IDS = [
  "headline",
  "summary",
  "experience",
  "skills",
  "education",
  "recommendations",
] as const;

/**
 * Standard CV section IDs for the audit flow.
 */
export const CV_SECTION_IDS = [
  "contact-info",
  "professional-summary",
  "work-experience",
  "skills-section",
  "education-section",
  "certifications",
] as const;

/**
 * Map section IDs to human-readable names for prompts.
 */
export const SECTION_DISPLAY_NAMES: Record<string, string> = {
  headline: "Headline",
  summary: "About / Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  recommendations: "Recommendations",
  "contact-info": "Contact Information",
  "professional-summary": "Professional Summary",
  "work-experience": "Work Experience",
  "skills-section": "Skills",
  "education-section": "Education",
  certifications: "Certifications",
};
