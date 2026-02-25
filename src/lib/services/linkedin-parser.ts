/**
 * Parse raw LinkedIn profile text into named sections.
 *
 * The input is typically pasted text from a LinkedIn profile page or
 * extracted via pdfjs-dist from a LinkedIn PDF export.
 *
 * Returns a Record mapping section IDs to their text content.
 * Missing sections are simply omitted from the result.
 *
 * V2: Broadened regex patterns for PDF-extracted text (prefix matching),
 * LLM fallback for unstructured text, and "featured" section support.
 */

import { callLLM, LLM_MODEL_FAST } from "./llm-client";
import { extractJson } from "@/lib/schemas/llm-output";
import type { Locale } from "@/lib/types";

// ── Section header patterns → internal IDs ───────────────
// V2: prefix matching instead of exact line matching, so
// "About me" or "Experience Senior Dev at Google" still triggers.
const SECTION_HEADERS: { pattern: RegExp; id: string }[] = [
  // English patterns
  { pattern: /^about(\s|$)/i, id: "summary" },
  { pattern: /^summary(\s|$)/i, id: "summary" },
  { pattern: /^experience(\s|$)/i, id: "experience" },
  { pattern: /^education(\s|$)/i, id: "education" },
  { pattern: /^skills(\s|$)/i, id: "skills" },
  { pattern: /^recommendations?(\s|$)/i, id: "recommendations" },
  { pattern: /^featured(\s|$)/i, id: "featured" },
  { pattern: /^activity(\s|$)/i, id: "featured" },
  { pattern: /^licenses?\s*&?\s*certifications?/i, id: "certifications" },
  { pattern: /^volunteer(\s|$)/i, id: "volunteer" },
  { pattern: /^projects?(\s|$)/i, id: "projects" },
  { pattern: /^publications?(\s|$)/i, id: "publications" },
  { pattern: /^honors?\s*&?\s*awards?/i, id: "honors" },
  // Spanish patterns (LinkedIn PDFs in ES)
  { pattern: /^acerca\s+de(\s|$)/i, id: "summary" },
  { pattern: /^extracto(\s|$)/i, id: "summary" },
  { pattern: /^experiencia(\s|$)/i, id: "experience" },
  { pattern: /^educación(\s|$)/i, id: "education" },
  { pattern: /^formación(\s|$)/i, id: "education" },
  { pattern: /^aptitudes(\s|$)/i, id: "skills" },
  { pattern: /^habilidades(\s|$)/i, id: "skills" },
  { pattern: /^recomendaciones?(\s|$)/i, id: "recommendations" },
  { pattern: /^destacados?(\s|$)/i, id: "featured" },
];

/**
 * Match a line against known section headers.
 * Returns the section ID or null if no match.
 */
function matchHeader(line: string): string | null {
  const trimmed = line.trim();
  // Skip very long lines — they're content, not headers
  if (trimmed.length > 80) return null;
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
        // Don't overwrite if section was already captured (e.g. duplicate headers)
        if (!sections[currentSection]) {
          sections[currentSection] = content;
        } else {
          sections[currentSection] += "\n\n" + content;
        }
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
      if (sections.headline && line.trim()) {
        sections.headline += "\n" + line.trim();
      }
    }
  }

  // Flush last section
  flushSection();

  return sections;
}

// ── LLM Parser Fallback ───────────────────────────────────
// Cost controls: max 5,000 chars, 10s timeout, no retry

const LLM_PARSER_MAX_CHARS = 5_000;
const LLM_PARSER_TIMEOUT_MS = 10_000;

const LLM_PARSER_PROMPT = `You are a LinkedIn profile parser. Split the following LinkedIn profile text into named sections.

Return a JSON object with this exact structure:
{
  "sections": {
    "headline": "the person's professional headline/title",
    "summary": "about/summary section content",
    "experience": "work experience content",
    "skills": "skills and endorsements content",
    "education": "education content",
    "featured": "featured/activity content",
    "recommendations": "recommendations content"
  }
}

Rules:
- Only include sections that have actual content in the text
- If a section is not present, omit it from the JSON
- Keep the original text intact — do not summarize or rewrite
- The headline is typically the first line (job title or professional tagline)

Profile text:
`;

/**
 * Parse LinkedIn sections with regex first, then LLM fallback if
 * regex yields ≤1 section from substantial text.
 *
 * Cost controls (constraint #4):
 * - Truncates input to 5,000 chars before LLM call
 * - 10-second timeout via AbortController
 * - Never retries the parser LLM call
 * - Silently returns regex results on any failure
 */
export async function parseLinkedinSectionsWithFallback(
  rawText: string,
  _locale: Locale = "en"
): Promise<Record<string, string>> {
  // Always try regex first
  const regexResult = parseLinkedinSections(rawText);

  // If regex found 2+ sections or text is short, regex is sufficient
  const sectionCount = Object.keys(regexResult).length;
  if (sectionCount >= 2 || rawText.trim().length <= 300) {
    return regexResult;
  }

  // LLM fallback: text is substantial but regex found ≤1 section
  try {
    const truncated = rawText.slice(0, LLM_PARSER_MAX_CHARS);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      LLM_PARSER_TIMEOUT_MS
    );

    try {
      const result = await callLLM({
        model: LLM_MODEL_FAST,
        systemPrompt: LLM_PARSER_PROMPT + truncated,
        userMessage:
          "Parse this profile into sections. Return ONLY a valid JSON object.",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const jsonStr = extractJson(result.text);
      const parsed = JSON.parse(jsonStr);

      if (parsed?.sections && typeof parsed.sections === "object") {
        // Merge LLM results with regex results (regex takes priority)
        const merged = { ...regexResult };
        for (const [id, content] of Object.entries(parsed.sections)) {
          if (
            typeof content === "string" &&
            content.trim().length > 0 &&
            !merged[id]
          ) {
            merged[id] = content.trim();
          }
        }
        return merged;
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // LLM fallback failed — silently return regex results
  }

  return regexResult;
}

/**
 * Standard LinkedIn sections IDs used in the audit flow.
 * The orchestrator iterates over these to score and rewrite.
 * V2: added "featured" section
 */
export const LINKEDIN_SECTION_IDS = [
  "headline",
  "summary",
  "experience",
  "skills",
  "education",
  "featured",
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
  featured: "Featured & Activity",
  recommendations: "Recommendations",
  "contact-info": "Contact Information",
  "professional-summary": "Professional Summary",
  "work-experience": "Work Experience",
  "skills-section": "Skills",
  "education-section": "Education",
  certifications: "Certifications",
};
