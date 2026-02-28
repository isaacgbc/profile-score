/**
 * Client-side entry synthesizer for ANY entry-based section (Experience, Education, etc.).
 *
 * When the server-side parser returns <=1 entry, this utility splits the raw
 * section text into multiple synthetic entries using heuristics:
 *   - Year/date patterns
 *   - Blank-line separators
 *   - Organization keywords (companies, institutions, etc.)
 *
 * Returns RewriteEntry[] with structured organization/title/dateRange fields.
 */

import type { RewriteEntry } from "@/lib/types";

// ── Date/year patterns ──────────────────────────────────
const YEAR_RE = /\b(19|20)\d{2}\b/;
const DATE_RANGE_RE =
  /(?:(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(?:de\s+)?)?\d{4}\s*[-–—]\s*(?:(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(?:de\s+)?)?\d{4}|(?:(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(?:de\s+)?)?\d{4}\s*[-–—]\s*(?:present|actual|actualidad|presente|current)/i;

/** Inline date in parentheses: · (date range) */
const INLINE_DATE_PAREN_RE = /·\s*\(.*?\d{4}.*?\)/;

// ── Organization keywords (covers both experience & education) ────
const ORGANIZATION_RE =
  /\b(?:universid|university|college|instituto|institute|school|colegio|escuela|aceler|programa|bootcamp|maestr[ií]a|master|mba|phd|doctorad|bachelor|licenciat|diplomad|certificad|posgrado|postgrado|facultad|company|corp|inc|ltd|llc|gmbh|s\.?a\.?|s\.?l\.?|empresa|consultora|startup|freelance|autónom|contractor|director|manager|engineer|developer|analyst|specialist|coordinator|lead|senior|junior|head\s+of|vp\s+of|chief)\b/i;

/**
 * Synthesize entries from raw section text.
 *
 * Strategy:
 * 1. Split text into blocks by blank lines
 * 2. Identify blocks that look like entry boundaries (have dates/organizations)
 * 3. Merge orphan blocks with their parent entry
 * 4. Create RewriteEntry objects with structured fields
 *
 * If synthesis produces <=1 entry, falls back to returning the full text
 * as a single editable entry.
 */
export function synthesizeEntries(
  rawText: string,
  rewrittenText?: string
): RewriteEntry[] {
  if (!rawText || rawText.trim().length < 10) {
    return [createFallbackEntry(rawText || "", rewrittenText || rawText || "", 0)];
  }

  // Strategy 1: Split by blank lines into blocks
  const lines = rawText.split("\n");
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        blocks.push([...current]);
        current = [];
      }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  if (blocks.length === 0) {
    return [createFallbackEntry(rawText, rewrittenText || rawText, 0)];
  }

  // Strategy 2: Identify entry boundaries
  const boundaryIndices: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const blockText = blocks[i].join(" ");
    const hasDate = DATE_RANGE_RE.test(blockText) || INLINE_DATE_PAREN_RE.test(blockText);
    const hasOrg = ORGANIZATION_RE.test(blockText);
    const hasYear = YEAR_RE.test(blockText);

    if (hasDate || hasOrg || (hasYear && blockText.length < 200)) {
      boundaryIndices.push(i);
    }
  }

  // If no boundaries found, chunk it
  if (boundaryIndices.length === 0) {
    return chunkIntoEntries(rawText, rewrittenText || rawText);
  }

  // Strategy 3: Merge blocks into entries
  const entries: RewriteEntry[] = [];

  for (let b = 0; b < boundaryIndices.length; b++) {
    const startIdx = boundaryIndices[b];
    const endIdx = b + 1 < boundaryIndices.length ? boundaryIndices[b + 1] : blocks.length;

    // Include preceding non-boundary blocks
    const lookbackStart = b === 0 ? 0 : boundaryIndices[b - 1] + 1;
    const precedingBlocks: string[] = [];
    for (let p = lookbackStart; p < startIdx; p++) {
      if (!boundaryIndices.includes(p)) {
        precedingBlocks.push(...blocks[p]);
      }
    }

    const entryLines: string[] = [...precedingBlocks];
    for (let i = startIdx; i < endIdx; i++) {
      entryLines.push(...blocks[i]);
    }

    const entryText = entryLines.join("\n").trim();
    if (entryText.length < 5) continue;

    const { organization, title } = extractOrgAndTitle(entryLines);
    const dateRange = extractDateRange(entryText);
    const displayTitle = organization || title || extractEntryTitle(entryLines);

    entries.push({
      entryIndex: entries.length,
      entryTitle: displayTitle + (dateRange ? ` (${dateRange})` : ""),
      organization: organization || undefined,
      title: title || undefined,
      dateRange: dateRange || undefined,
      original: entryText,
      improvements: "",
      missingSuggestions: [],
      rewritten: entryText,
    });
  }

  // If still <=1, chunk
  if (entries.length <= 1) {
    return chunkIntoEntries(rawText, rewrittenText || rawText);
  }

  // Try to match synthesized entries with rewritten text blocks
  if (rewrittenText && rewrittenText !== rawText) {
    matchRewrittenToEntries(entries, rewrittenText);
  }

  return entries;
}

/**
 * Extract organization and title from entry header lines.
 * Heuristic: short entity-like line = organization, role/program-like line = title.
 * If ambiguous, first non-date line = organization, second = title.
 */
function extractOrgAndTitle(lines: string[]): { organization: string; title: string } {
  const nonDateLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    // Skip pure date lines
    if (/^\s*(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|\d)/i.test(trimmed) && trimmed.length < 50) continue;
    // Skip bullet lines (descriptions)
    if (/^\s*[-*•]/.test(trimmed)) continue;
    // Clean inline date from line
    const cleaned = trimmed.replace(/\s*·\s*\(.*?\)$/, "").trim();
    if (cleaned.length >= 3) {
      nonDateLines.push(cleaned.length > 120 ? cleaned.slice(0, 117) + "..." : cleaned);
    }
    // Only consider first 2 header lines
    if (nonDateLines.length >= 2) break;
  }

  if (nonDateLines.length >= 2) {
    // First line = organization, second = title/role
    return { organization: nonDateLines[0], title: nonDateLines[1] };
  } else if (nonDateLines.length === 1) {
    return { organization: nonDateLines[0], title: "" };
  }
  return { organization: "", title: "" };
}

/** Extract the most likely display title from entry lines (legacy fallback) */
function extractEntryTitle(lines: string[]): string {
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    if (/^\s*(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|\d)/i.test(trimmed) && trimmed.length < 40) continue;
    const cleaned = trimmed.replace(/\s*·\s*\(.*?\)$/, "").trim();
    return cleaned.length > 80 ? cleaned.slice(0, 77) + "..." : cleaned;
  }
  return lines[0]?.trim().slice(0, 80) || "Entry";
}

/** Extract date range string from text */
function extractDateRange(text: string): string | null {
  const parenMatch = text.match(/·\s*\((.*?\d{4}.*?)\)/);
  if (parenMatch) return parenMatch[1].trim();

  const rangeMatch = text.match(DATE_RANGE_RE);
  if (rangeMatch) return rangeMatch[0].trim();

  return null;
}

/**
 * Fallback: chunk text into roughly equal entries.
 */
function chunkIntoEntries(rawText: string, rewrittenText: string): RewriteEntry[] {
  const lines = rawText.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length <= 3) {
    return [createFallbackEntry(rawText, rewrittenText, 0)];
  }

  const midpoint = Math.floor(lines.length / 2);
  const firstHalf = lines.slice(0, midpoint).join("\n").trim();
  const secondHalf = lines.slice(midpoint).join("\n").trim();

  const entries: RewriteEntry[] = [];
  if (firstHalf.length > 5) {
    const { organization, title } = extractOrgAndTitle(firstHalf.split("\n"));
    entries.push({
      entryIndex: 0,
      entryTitle: organization || title || extractEntryTitle(firstHalf.split("\n")),
      organization: organization || undefined,
      title: title || undefined,
      original: firstHalf,
      improvements: "",
      missingSuggestions: [],
      rewritten: firstHalf,
    });
  }
  if (secondHalf.length > 5) {
    const { organization, title } = extractOrgAndTitle(secondHalf.split("\n"));
    entries.push({
      entryIndex: entries.length,
      entryTitle: organization || title || extractEntryTitle(secondHalf.split("\n")),
      organization: organization || undefined,
      title: title || undefined,
      original: secondHalf,
      improvements: "",
      missingSuggestions: [],
      rewritten: secondHalf,
    });
  }

  return entries.length > 0
    ? entries
    : [createFallbackEntry(rawText, rewrittenText, 0)];
}

/** Create a single fallback entry from the entire text */
function createFallbackEntry(
  original: string,
  rewritten: string,
  index: number
): RewriteEntry {
  const { organization, title } = extractOrgAndTitle(original.split("\n"));
  return {
    entryIndex: index,
    entryTitle: organization || title || extractEntryTitle(original.split("\n")),
    organization: organization || undefined,
    title: title || undefined,
    original: original.trim(),
    improvements: "",
    missingSuggestions: [],
    rewritten: rewritten.trim(),
  };
}

/** Match rewritten text blocks to synthesized entries by position */
function matchRewrittenToEntries(entries: RewriteEntry[], rewrittenText: string): void {
  const rewrittenBlocks = rewrittenText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 10);

  if (rewrittenBlocks.length >= entries.length) {
    const blocksPerEntry = Math.floor(rewrittenBlocks.length / entries.length);
    for (let i = 0; i < entries.length; i++) {
      const start = i * blocksPerEntry;
      const end = i === entries.length - 1 ? rewrittenBlocks.length : start + blocksPerEntry;
      entries[i].rewritten = rewrittenBlocks.slice(start, end).join("\n\n");
    }
  }
}

/**
 * Create a blank entry for manual addition.
 */
export function createBlankEntry(index: number): RewriteEntry {
  return {
    entryIndex: index,
    entryTitle: "New Entry",
    organization: "",
    title: "",
    dateRange: "",
    original: "",
    improvements: "",
    missingSuggestions: [],
    rewritten: "",
  };
}
