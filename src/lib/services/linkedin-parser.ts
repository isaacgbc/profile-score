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

  // HOTFIX-3B: Merge sidebar-extracted metadata into parsed sections.
  // If sidebar skills were extracted but no skills section parsed, use them
  if (pdfMeta.sidebarSkills.length > 0 && !regexResult.skills) {
    regexResult.skills = pdfMeta.sidebarSkills.join("\n");
  }

  // HOTFIX-3B: If sidebar certifications were extracted but no certifications section parsed, use them
  if (pdfMeta.certifications.length > 0 && !regexResult.certifications) {
    regexResult.certifications = pdfMeta.certifications.join("\n");
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
  `^\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+(?:de\\s+)?)?\\d{4}\\s*[-–—]\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+(?:de\\s+)?)?(?:\\d{4}|Present|Actual|Actualidad|Presente|Current)(?:\\s*·\\s*.*)?\\s*$`,
  "i"
);

/** Duration suffix patterns: "· 2 yrs 3 mos", "· 1 año 6 meses" */
const DURATION_SUFFIX_RE =
  /\s*·\s*(?:\d+\s*(?:yr|year|año|mes|mo|month)s?\s*)+/i;

/** Year-only line pattern (e.g., "2020", "2018 - 2022", "Class of 2020", "Completed 2024") */
const YEAR_ONLY_RE = /^\s*(?:Class\s+of\s+|Completed\s+)?(?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|Present|Actual))?\s*$/i;

/** Inline date in parentheses at end of line: (2013–2015), (2020), (junio de 2024 - octubre de 2024) */
const INLINE_DATE_PAREN_RE = new RegExp(
  `\\(\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})(?:\\s+(?:de\\s+))?)?` +
  `(?:19|20)\\d{2}` +
  `(?:\\s*[-–—]\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})(?:\\s+(?:de\\s+))?)?` +
  `(?:(?:19|20)\\d{2}|Present|Actual|Actualidad|Presente|in\\s+progress|Expected\\s+\\w+\\s+\\d{4}))?` +
  `\\s*\\)\\s*$`,
  "i"
);

/**
 * HOTFIX-URGENT-2: Extract inline date from org/description strings.
 * Handles patterns like "Economía · (2019 - 2023)" or "Computer Science (2013–2015)"
 * Returns { cleanText, dateRange } where dateRange is the extracted date or "".
 */
function extractInlineDate(text: string): { cleanText: string; dateRange: string } {
  // Pattern: "· (date range)" or just "(date range)" at end of string
  const inlineDateMatch = text.match(
    /\s*·?\s*\(\s*((?:(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:de\s+)?)?(?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:de\s+)?)?(?:(?:19|20)\d{2}|Present|Actual|Actualidad|Presente))?)\s*\)\s*$/i
  );
  if (inlineDateMatch) {
    const dateRange = inlineDateMatch[1].trim();
    const cleanText = text.slice(0, text.indexOf(inlineDateMatch[0])).trim();
    return { cleanText, dateRange };
  }
  return { cleanText: text, dateRange: "" };
}

/**
 * HOTFIX-3B: Fallback education parser when no standard date range lines found.
 * Splits on blank-line-separated blocks, treating each block as an entry.
 * Also splits on year-only lines.
 */
function parseEducationFallback(lines: string[]): ParsedEntry[] {
  // Strategy 1: Split on year-only lines
  const yearLineIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (YEAR_ONLY_RE.test(lines[i])) {
      yearLineIndices.push(i);
    }
  }

  if (yearLineIndices.length > 0) {
    const entries: ParsedEntry[] = [];
    for (let y = 0; y < yearLineIndices.length; y++) {
      const yearIdx = yearLineIndices[y];
      const dateRange = lines[yearIdx].trim();
      const prevEnd = y > 0 ? yearLineIndices[y - 1] + 1 : 0;
      const headerStart = Math.max(prevEnd, yearIdx - 3);

      const headerLines: string[] = [];
      for (let h = headerStart; h < yearIdx; h++) {
        const hl = lines[h].trim();
        if (hl.length > 0) headerLines.push(hl);
      }

      let title = "";
      let organization = "";
      if (headerLines.length >= 2) {
        title = headerLines[headerLines.length - 2];
        organization = headerLines[headerLines.length - 1];
      } else if (headerLines.length === 1) {
        title = headerLines[0];
      }

      const descStart = yearIdx + 1;
      const descEnd = y + 1 < yearLineIndices.length
        ? Math.max(descStart, yearLineIndices[y + 1] - 2)
        : lines.length;
      const description = lines.slice(descStart, descEnd).join("\n").trim();

      if (title || organization) {
        entries.push({ title, organization, dateRange, description });
      }
    }
    if (entries.length > 0) return entries;
  }

  // Strategy 2: Split on blank-line groups (1+ blank line = entry separator for education)
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  // HOTFIX-URGENT-3: Date-aware block merging.
  // Identify which blocks contain inline dates, then pair each date-block
  // with the previous non-date block (institution name).
  const mergedBlocks: string[][] = [];
  for (let i = 0; i < blocks.length; i++) {
    const blockHasDate = blocks[i].some((l) => INLINE_DATE_PAREN_RE.test(l.trim()));
    if (
      !blockHasDate &&
      blocks[i].length <= 2 &&
      i + 1 < blocks.length &&
      blocks[i + 1].some((l) => INLINE_DATE_PAREN_RE.test(l.trim()))
    ) {
      // Non-date block followed by date block → merge as one entry
      mergedBlocks.push([...blocks[i], ...blocks[i + 1]]);
      i++; // skip next
    } else if (blockHasDate && mergedBlocks.length > 0) {
      // Date block not preceded by a merge candidate — merge with previous
      const prev = mergedBlocks[mergedBlocks.length - 1];
      const prevHasDate = prev.some((l) => INLINE_DATE_PAREN_RE.test(l.trim()));
      if (!prevHasDate) {
        mergedBlocks[mergedBlocks.length - 1] = [...prev, ...blocks[i]];
      } else {
        mergedBlocks.push([...blocks[i]]);
      }
    } else {
      mergedBlocks.push([...blocks[i]]);
    }
  }

  // Second pass: merge orphan short blocks (no date) with the next dated block.
  // Handles wrapped lines where institution name is separated from degree+date.
  const finalBlocks: string[][] = [];
  for (let i = 0; i < mergedBlocks.length; i++) {
    const hasDate = mergedBlocks[i].some((l) => INLINE_DATE_PAREN_RE.test(l.trim()));
    if (
      !hasDate &&
      mergedBlocks[i].length <= 2 &&
      i + 1 < mergedBlocks.length &&
      mergedBlocks[i + 1].some((l) => INLINE_DATE_PAREN_RE.test(l.trim()))
    ) {
      finalBlocks.push([...mergedBlocks[i], ...mergedBlocks[i + 1]]);
      i++;
    } else {
      finalBlocks.push(mergedBlocks[i]);
    }
  }

  if (finalBlocks.length >= 2) {
    const blockEntries = finalBlocks.map((block) => {
      const nonEmpty = block.map((l) => l.trim()).filter(Boolean);
      const rawTitle = nonEmpty[0] ?? "";
      const rawOrg = nonEmpty.length >= 2 ? nonEmpty[1] : "";
      const rawDesc = nonEmpty.slice(2).join("\n").trim();

      // Extract inline dates from title, org, or description
      const titleExtracted = extractInlineDate(rawTitle);
      const orgExtracted = extractInlineDate(rawOrg);
      const descExtracted = rawDesc ? extractInlineDate(rawDesc) : { cleanText: "", dateRange: "" };
      const dateRange = titleExtracted.dateRange || orgExtracted.dateRange || descExtracted.dateRange;

      return {
        title: titleExtracted.cleanText || rawTitle,
        organization: orgExtracted.cleanText || rawOrg,
        dateRange,
        description: descExtracted.cleanText || rawDesc,
      };
    });
    // Filter out entries that are just noise (no title and no org)
    const validEntries = blockEntries.filter((e) => e.title.length > 0 || e.organization.length > 0);
    if (validEntries.length > 0) return validEntries;
  }

  // Strategy 3: Single-line entries with inline dates in parens
  // e.g. "Stanford University — M.S. Computer Science (2013–2015)"
  const inlineDateEntries: ParsedEntry[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (INLINE_DATE_PAREN_RE.test(trimmed)) {
      // Extract the date from parens
      const parenMatch = trimmed.match(/\(([^)]+)\)\s*$/);
      const dateRange = parenMatch ? parenMatch[1].trim() : "";
      const beforeParen = trimmed.replace(/\s*\([^)]+\)\s*$/, "").trim();

      // Split on " — " or " - " or " – " for title/org
      const dashSplit = beforeParen.split(/\s*[—–]\s*/);
      let title = "";
      let organization = "";
      if (dashSplit.length >= 2) {
        title = dashSplit[0].trim();
        organization = dashSplit.slice(1).join(" — ").trim();
      } else {
        title = beforeParen;
      }

      inlineDateEntries.push({ title, organization, dateRange, description: "" });
    } else if (trimmed.length > 5) {
      // Non-date line that's not empty — could be an entry without date
      // Only include if we haven't found inline-date entries (avoid mixing)
      if (inlineDateEntries.length === 0) {
        // Collect as potential dateless entries — but don't return them
        // unless there are 2+ (otherwise we'd just have noise)
      }
    }
  }
  if (inlineDateEntries.length > 0) return inlineDateEntries;

  return [];
}

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

  const isEducationSection = ["education", "education-section"].includes(sectionId);

  if (dateLineIndices.length === 0) {
    // HOTFIX-URGENT: Fallback for sections without standard date lines.
    if (isEducationSection) {
      const fallbackEntries = parseEducationFallback(lines);
      if (fallbackEntries.length > 0) {
        console.log(`[diag] educationParser: dateLines=0, fallback=${fallbackEntries.length} entries`);
        result.entries = fallbackEntries;
        result.confidence = "low";
        return result;
      }
    }
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

  // HOTFIX-URGENT-2: For education sections, always check if fallback finds more entries.
  // Fallback entries must pass quality filter (real titles, not noise like "GPA: 3.9").
  if (isEducationSection) {
    const fallbackEntries = parseEducationFallback(lines);
    // Quality filter: only count fallback entries that have real titles (not noise)
    const qualityFallback = fallbackEntries.filter(
      (e) => e.title.length >= 2 && !YEAR_ONLY_RE.test(e.title) && !DATE_LINE_RE.test(e.title)
    );
    if (qualityFallback.length > entries.length) {
      const droppedCount = qualityFallback.length - entries.length;
      console.log(
        `[diag] educationParser: dateBasedEntries=${entries.length}, fallbackEntries=${qualityFallback.length}, ` +
        `preferring=fallback for ${sectionId}, droppedEducationBlocks=${droppedCount}`
      );
      result.entries = qualityFallback;
      result.confidence = "low";
      return result;
    }
  }

  // ── HOTFIX-CV: Post-parse merge guard ──
  // Merge fragment entries (bullet-only, title-only, date-only) back into the
  // preceding real entry. This prevents bullet lines from becoming standalone cards.
  const mergedEntries = mergeFragmentEntries(entries);

  result.entries = mergedEntries;

  // Compute confidence with fragment-aware scoring
  const triadCount = mergedEntries.filter(
    (e) => (e.title || e.organization) && e.dateRange
  ).length;
  const bulletOnlyCount = mergedEntries.filter(
    (e) => !e.title && !e.organization && !e.dateRange
  ).length;
  const tinyEntryCount = mergedEntries.filter(
    (e) => (e.title + e.organization + e.description).length < 30
  ).length;

  // High confidence requires: entries found, section has content, most entries have triads
  if (
    mergedEntries.length > 0 &&
    sectionText.length > 200 &&
    bulletOnlyCount === 0 &&
    tinyEntryCount <= 1 &&
    triadCount >= mergedEntries.length * 0.5
  ) {
    result.confidence = "high";
  } else {
    result.confidence = "low";
  }

  console.log(
    `[diag] entryParser: sectionId=${sectionId}, dateLines=${dateLineIndices.length}, ` +
    `rawEntries=${entries.length}, mergedEntries=${mergedEntries.length}, ` +
    `triadCount=${triadCount}, bulletOnlyCount=${bulletOnlyCount}, ` +
    `tinyEntryCount=${tinyEntryCount}, confidence=${result.confidence}`
  );

  return result;
}

/**
 * HOTFIX-CV: Merge fragment entries back into the preceding real entry.
 *
 * A "fragment" is an entry that looks like it was incorrectly split from
 * a parent entry. Indicators:
 * - Title starts with a bullet marker (-, *, •, –)
 * - No title AND no organization (just description or date)
 * - Very short total content (< 40 chars) with no clear org/title/date triad
 * - Adjacent to a real entry and looks like continuation
 */
function mergeFragmentEntries(entries: ParsedEntry[]): ParsedEntry[] {
  if (entries.length <= 1) return entries;

  const merged: ParsedEntry[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isFragment = isFragmentEntry(entry);

    if (isFragment && merged.length > 0) {
      // Merge into preceding entry
      const parent = merged[merged.length - 1];
      const fragmentText = buildFragmentText(entry);
      parent.description = parent.description
        ? parent.description + "\n" + fragmentText
        : fragmentText;
      console.log(
        `[diag] mergeGuard: merged fragment ${i} into entry ${merged.length - 1} ` +
        `(fragment: title="${entry.title.slice(0, 30)}", org="${entry.organization.slice(0, 30)}")`
      );
    } else {
      merged.push({ ...entry });
    }
  }

  return merged;
}

/** Check if an entry is a fragment that should be merged into the preceding entry */
function isFragmentEntry(entry: ParsedEntry): boolean {
  const { title, organization, dateRange, description } = entry;

  // Bullet-only: title starts with bullet marker
  if (/^\s*[-*•–]/.test(title)) return true;

  // No title AND no organization — only has description or dateRange
  if (!title.trim() && !organization.trim()) return true;

  // Title looks like a bullet point or continuation (starts with lowercase, very short)
  if (
    title.length > 0 &&
    title.length < 60 &&
    !organization.trim() &&
    !dateRange.trim() &&
    /^[a-záéíóú]/.test(title.trim())
  ) {
    return true;
  }

  // Very short total content with no org+title triad
  const totalChars = (title + organization + description).length;
  if (totalChars < 40 && !organization.trim() && !dateRange.trim()) return true;

  return false;
}

/** Build text from a fragment entry for appending to parent description */
function buildFragmentText(entry: ParsedEntry): string {
  const parts: string[] = [];
  if (entry.title) parts.push(entry.title);
  if (entry.organization) parts.push(entry.organization);
  if (entry.dateRange) parts.push(entry.dateRange);
  if (entry.description) parts.push(entry.description);
  return parts.join("\n");
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
