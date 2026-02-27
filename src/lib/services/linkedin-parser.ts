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
 *
 * V3: PDF pre-cleaning (linkedin-pdf-cleaner), per-entry parsing for
 * experience/education sections (EN + ES date/title support).
 */

import { callLLM, LLM_MODEL_FAST } from "./llm-client";
import { extractJson } from "@/lib/schemas/llm-output";
import { cleanLinkedinPdfText } from "./linkedin-pdf-cleaner";
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
  // V3: Pre-clean PDF noise before parsing
  const { cleaned, metadata: pdfMeta } = cleanLinkedinPdfText(rawText);

  if (pdfMeta.removedPageMarkers > 0 || pdfMeta.contactLines.length > 0) {
    console.log(
      `[parser] PDF cleaner: removed ${pdfMeta.removedPageMarkers} page markers, ` +
      `${pdfMeta.contactLines.length} contact lines, ` +
      `${pdfMeta.sidebarSkills.length} sidebar skills, ` +
      `${pdfMeta.certifications.length} sidebar certs`
    );
  }

  // Always try regex first (on cleaned text)
  const regexResult = parseLinkedinSections(cleaned);

  // If sidebar skills were extracted but no skills section parsed, use them
  if (pdfMeta.sidebarSkills.length > 0 && !regexResult.skills) {
    regexResult.skills = pdfMeta.sidebarSkills.join("\n");
  }

  // If regex found 2+ sections or text is short, regex is sufficient
  const sectionCount = Object.keys(regexResult).length;

  console.log(
    `[parser] regex: ${sectionCount} sections=[${Object.keys(regexResult).join(", ")}], ` +
    `cleaned=${cleaned.length}chars, lines=${cleaned.split("\n").length}`
  );

  if (sectionCount >= 2 || cleaned.trim().length <= 300) {
    return regexResult;
  }

  console.log(`[parser] LLM fallback triggered (${sectionCount} sections from ${cleaned.length} chars)`);

  // LLM fallback: text is substantial but regex found ≤1 section
  try {
    const truncated = cleaned.slice(0, LLM_PARSER_MAX_CHARS);

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
  "certifications",
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

// ── Per-Entry Parsing ─────────────────────────────────────
// V3: Parse experience/education sections into individual entries.
// Supports both English and Spanish date formats.

export interface ParsedEntry {
  /** Role/degree title, e.g. "Senior Software Engineer" */
  title: string;
  /** Company/institution name, e.g. "Google" */
  organization: string;
  /** Date range string, e.g. "Jan 2020 - Present" */
  dateRange: string;
  /** Description/bullets for this entry */
  description: string;
}

export interface ParsedSectionWithEntries {
  rawText: string;
  entries: ParsedEntry[];
  confidence: "high" | "low";
}

// EN month names
const EN_MONTHS =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
// ES month names
const ES_MONTHS =
  "ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t(?:iembre)?)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?";

/** Matches a date range line (EN + ES):
 * "Jan 2020 - Present", "2020 - 2023", "enero 2019 - Actual", etc.
 */
const DATE_RANGE_RE = new RegExp(
  `(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+)?\\d{4}\\s*[-–—]\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+)?(?:\\d{4}|Present|Actual|Actualidad|Presente|Current)`,
  "i"
);

/** Matches a standalone date range line (most of the line is the date) */
const DATE_LINE_RE = new RegExp(
  `^\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+)?\\d{4}\\s*[-–—]\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+)?(?:\\d{4}|Present|Actual|Actualidad|Presente|Current)(?:\\s*·\\s*.*)?\\s*$`,
  "i"
);

/** Duration suffix patterns: "· 2 yrs 3 mos", "· 1 año 6 meses" */
const DURATION_SUFFIX_RE =
  /\s*·\s*(?:\d+\s*(?:yr|year|año|mes|mo|month)s?\s*)+/i;

/**
 * Parse a section (experience or education) into individual entries.
 * Returns entries with title, organization, dateRange, and description.
 *
 * Only processes "experience", "education", "work-experience",
 * "education-section" section IDs. All others return entries: [].
 */
export function parseEntriesFromSection(
  sectionId: string,
  sectionText: string
): ParsedSectionWithEntries {
  const result: ParsedSectionWithEntries = {
    rawText: sectionText,
    entries: [],
    confidence: "low",
  };

  // Only parse entry-based sections
  const entrySections = [
    "experience",
    "education",
    "work-experience",
    "education-section",
  ];
  if (!entrySections.includes(sectionId)) return result;

  if (!sectionText || sectionText.trim().length < 30) return result;

  const lines = sectionText.split("\n");

  // Strategy: find date range lines, then work backwards for title/org
  // and forwards for description.
  const dateLineIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (DATE_LINE_RE.test(lines[i])) {
      dateLineIndices.push(i);
    }
  }

  if (dateLineIndices.length === 0) {
    // No date lines found — try splitting on date ranges within lines
    // (some PDF extractions merge title + date on one line)
    return result; // confidence stays "low"
  }

  const entries: ParsedEntry[] = [];

  for (let d = 0; d < dateLineIndices.length; d++) {
    const dateIdx = dateLineIndices[d];
    const nextDateIdx =
      d + 1 < dateLineIndices.length ? dateLineIndices[d + 1] : lines.length;

    // Extract date range (strip duration suffix for cleanliness)
    const dateRaw = lines[dateIdx].trim();
    const dateRange = dateRaw.replace(DURATION_SUFFIX_RE, "").trim();

    // Title and org: look at 1-2 lines before the date line
    let title = "";
    let organization = "";

    // Determine how far back we can look (don't go past previous entry)
    const prevEntryEnd =
      d > 0 ? dateLineIndices[d - 1] + 1 : 0;
    const headerStart = Math.max(prevEntryEnd, dateIdx - 3);

    // Collect non-empty header lines before date
    const headerLines: string[] = [];
    for (let h = headerStart; h < dateIdx; h++) {
      const hl = lines[h].trim();
      if (hl.length > 0 && !DATE_LINE_RE.test(hl)) {
        headerLines.push(hl);
      }
    }

    if (headerLines.length >= 2) {
      // Last header line = organization, second-to-last = title
      title = headerLines[headerLines.length - 2];
      organization = headerLines[headerLines.length - 1];
    } else if (headerLines.length === 1) {
      title = headerLines[0];
    }

    // Description: lines after date until next entry's header zone
    const descStart = dateIdx + 1;
    // Leave 2-3 lines before next date as header zone
    const descEnd =
      d + 1 < dateLineIndices.length
        ? Math.max(descStart, dateLineIndices[d + 1] - 2)
        : lines.length;

    const descLines: string[] = [];
    for (let dl = descStart; dl < descEnd; dl++) {
      const dLine = lines[dl].trim();
      // Stop if we hit what looks like the next entry's title
      // (short non-empty line followed by a date line within 2 lines)
      if (
        dLine.length > 0 &&
        dLine.length < 60 &&
        dl + 2 < lines.length &&
        d + 1 < dateLineIndices.length &&
        dateLineIndices[d + 1] - dl <= 2
      ) {
        break;
      }
      descLines.push(lines[dl]);
    }

    const description = descLines.join("\n").trim();

    if (title || dateRange) {
      entries.push({ title, organization, dateRange, description });
    }
  }

  result.entries = entries;
  result.confidence =
    entries.length > 0 && sectionText.length > 200 ? "high" : "low";

  return result;
}

// ── LLM Structuring Pass ─────────────────────────────────
// V4: Optional LLM structuring for PDF uploads. Gated behind
// ENABLE_STRUCTURING_PASS flag in orchestrator.

import {
  structureProfileText,
  structuredProfileToSections,
} from "./profile-structurer";

/**
 * Parse LinkedIn PDF text with optional LLM structuring pass.
 * Falls back to regex + LLM fallback if structuring fails or is disabled.
 *
 * @param rawText - Raw PDF text
 * @param locale - Locale for parsing
 * @param useStructuring - Whether to attempt LLM structuring (gated by flag + isPdfSource)
 * @returns { sections, structuringUsed, structuringDurationMs }
 */
export async function parseLinkedinWithStructuring(
  rawText: string,
  locale: Locale = "en",
  useStructuring: boolean = false
): Promise<{
  sections: Record<string, string>;
  structuringUsed: boolean;
  structuringDurationMs: number;
}> {
  if (!useStructuring) {
    const sections = await parseLinkedinSectionsWithFallback(rawText, locale);
    return { sections, structuringUsed: false, structuringDurationMs: 0 };
  }

  const structStart = Date.now();

  try {
    const structured = await structureProfileText(rawText);

    if (structured) {
      const structuredSections = structuredProfileToSections(structured);
      const structDuration = Date.now() - structStart;

      // Merge: regex results fill in sections that structuring missed
      const regexSections = await parseLinkedinSectionsWithFallback(
        rawText,
        locale
      );

      const merged = { ...regexSections };
      for (const [id, content] of Object.entries(structuredSections)) {
        if (content && content.trim().length > 0) {
          // Structuring takes priority for the 4 core sections
          merged[id] = content;
        }
      }

      console.log(
        `[parser] Structuring pass: used=true, duration=${structDuration}ms, ` +
        `structured=[${Object.keys(structuredSections).join(", ")}], ` +
        `merged=[${Object.keys(merged).join(", ")}]`
      );

      return {
        sections: merged,
        structuringUsed: true,
        structuringDurationMs: structDuration,
      };
    }
  } catch (err) {
    console.warn(
      `[parser] Structuring pass failed, falling back to regex: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  // Structuring returned null or failed — fall back to regex
  const structDuration = Date.now() - structStart;
  const sections = await parseLinkedinSectionsWithFallback(rawText, locale);
  return {
    sections,
    structuringUsed: false,
    structuringDurationMs: structDuration,
  };
}

/** Max entries to send to LLM for per-entry rewriting (cost control) */
export const MAX_ENTRIES_PER_SECTION = 6;

/** Max characters per entry sent to LLM (cost control) */
export const MAX_CHARS_PER_ENTRY = 1_500;
