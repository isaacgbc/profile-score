/**
 * HOTFIX-URGENT-4: Client-side education entry synthesizer.
 *
 * When the server-side parser returns ≤1 education entry, this utility
 * splits the raw education section text into multiple synthetic entries
 * using heuristics (year patterns, blank line separators, institution keywords).
 *
 * Returns RewriteEntry[] that can be injected into the RewritePreview.entries array.
 */

import type { RewriteEntry } from "@/lib/types";

// ── Date/year patterns ──────────────────────────────────
const YEAR_RE = /\b(19|20)\d{2}\b/;
const DATE_RANGE_RE =
  /(?:(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(?:de\s+)?)?\d{4}\s*[-–—]\s*(?:(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(?:de\s+)?)?\d{4}|(?:(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(?:de\s+)?)?\d{4}\s*[-–—]\s*(?:present|actual|actualidad|presente|current)/i;

/** Inline date in parentheses: · (date range) */
const INLINE_DATE_PAREN_RE = /·\s*\(.*?\d{4}.*?\)/;

// ── Institution keywords ────────────────────────────────
const INSTITUTION_RE =
  /\b(?:universid|university|college|instituto|institute|school|colegio|escuela|aceler|programa|bootcamp|maestr[ií]a|master|mba|phd|doctorad|bachelor|licenciat|diplomad|certificad|posgrado|postgrado|facultad)\b/i;

/**
 * Synthesize education entries from raw section text.
 *
 * Strategy:
 * 1. Split text into blocks by blank lines
 * 2. Identify blocks that look like entry boundaries (have dates/institutions)
 * 3. Merge orphan blocks with their parent entry
 * 4. Create RewriteEntry objects
 *
 * If synthesis produces ≤1 entry, falls back to splitting the text into
 * roughly equal chunks (minimum 2 entries).
 */
export function synthesizeEducationEntries(
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
  // An entry boundary block typically has a date range or institution keyword
  const boundaryIndices: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const blockText = blocks[i].join(" ");
    const hasDate = DATE_RANGE_RE.test(blockText) || INLINE_DATE_PAREN_RE.test(blockText);
    const hasInstitution = INSTITUTION_RE.test(blockText);
    const hasYear = YEAR_RE.test(blockText);

    if (hasDate || hasInstitution || (hasYear && blockText.length < 200)) {
      boundaryIndices.push(i);
    }
  }

  // If no boundaries found, try splitting by standalone year lines or just chunk it
  if (boundaryIndices.length === 0) {
    return chunkIntoEntries(rawText, rewrittenText || rawText);
  }

  // Strategy 3: Merge blocks into entries
  // Each boundary block starts a new entry; non-boundary blocks attach to the previous entry
  const entries: RewriteEntry[] = [];

  for (let b = 0; b < boundaryIndices.length; b++) {
    const startIdx = boundaryIndices[b];
    const endIdx = b + 1 < boundaryIndices.length ? boundaryIndices[b + 1] : blocks.length;

    // Also include preceding non-boundary blocks (e.g., institution name before date block)
    const lookbackStart = b === 0 ? 0 : boundaryIndices[b - 1] + 1;
    const precedingBlocks: string[] = [];
    for (let p = lookbackStart; p < startIdx; p++) {
      if (!boundaryIndices.includes(p)) {
        precedingBlocks.push(...blocks[p]);
      }
    }

    // Collect all lines for this entry
    const entryLines: string[] = [...precedingBlocks];
    for (let i = startIdx; i < endIdx; i++) {
      entryLines.push(...blocks[i]);
    }

    const entryText = entryLines.join("\n").trim();
    if (entryText.length < 5) continue;

    const title = extractEntryTitle(entryLines);
    const dateRange = extractDateRange(entryText);

    entries.push({
      entryIndex: entries.length,
      entryTitle: title + (dateRange ? ` (${dateRange})` : ""),
      original: entryText,
      improvements: "",
      missingSuggestions: [],
      rewritten: entryText, // Use original as placeholder for rewritten
    });
  }

  // If still ≤1, chunk
  if (entries.length <= 1) {
    return chunkIntoEntries(rawText, rewrittenText || rawText);
  }

  // Try to match synthesized entries with rewritten text blocks
  if (rewrittenText && rewrittenText !== rawText) {
    matchRewrittenToEntries(entries, rewrittenText);
  }

  return entries;
}

/** Extract the most likely title from entry lines (first non-date, non-empty line) */
function extractEntryTitle(lines: string[]): string {
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;
    // Skip pure date lines
    if (/^\s*(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec|\d)/i.test(trimmed) && trimmed.length < 40) continue;
    // Clean up: remove trailing date in parens
    const cleaned = trimmed.replace(/\s*·\s*\(.*?\)$/, "").trim();
    return cleaned.length > 80 ? cleaned.slice(0, 77) + "..." : cleaned;
  }
  return lines[0]?.trim().slice(0, 80) || "Education Entry";
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
 * Splits by blank lines or double-newlines, creating at least 2 entries.
 */
function chunkIntoEntries(rawText: string, rewrittenText: string): RewriteEntry[] {
  const lines = rawText.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length <= 3) {
    // Too short to split — return as single entry
    return [createFallbackEntry(rawText, rewrittenText, 0)];
  }

  // Split roughly in half, preferring blank-line boundaries
  const midpoint = Math.floor(lines.length / 2);
  const firstHalf = lines.slice(0, midpoint).join("\n").trim();
  const secondHalf = lines.slice(midpoint).join("\n").trim();

  const entries: RewriteEntry[] = [];
  if (firstHalf.length > 5) {
    entries.push({
      entryIndex: 0,
      entryTitle: extractEntryTitle(firstHalf.split("\n")),
      original: firstHalf,
      improvements: "",
      missingSuggestions: [],
      rewritten: firstHalf,
    });
  }
  if (secondHalf.length > 5) {
    entries.push({
      entryIndex: entries.length,
      entryTitle: extractEntryTitle(secondHalf.split("\n")),
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
  return {
    entryIndex: index,
    entryTitle: extractEntryTitle(original.split("\n")),
    original: original.trim(),
    improvements: "",
    missingSuggestions: [],
    rewritten: rewritten.trim(),
  };
}

/**
 * Try to match rewritten text blocks to synthesized entries.
 * Splits rewritten text into blocks and assigns them to entries by position.
 */
function matchRewrittenToEntries(entries: RewriteEntry[], rewrittenText: string): void {
  // Split rewritten by double newlines
  const rewrittenBlocks = rewrittenText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 10);

  if (rewrittenBlocks.length >= entries.length) {
    // Assign blocks to entries proportionally
    const blocksPerEntry = Math.floor(rewrittenBlocks.length / entries.length);
    for (let i = 0; i < entries.length; i++) {
      const start = i * blocksPerEntry;
      const end = i === entries.length - 1 ? rewrittenBlocks.length : start + blocksPerEntry;
      entries[i].rewritten = rewrittenBlocks.slice(start, end).join("\n\n");
    }
  }
}

/**
 * Create a blank education entry for manual addition.
 */
export function createBlankEducationEntry(index: number): RewriteEntry {
  return {
    entryIndex: index,
    entryTitle: "New Education Entry",
    original: "",
    improvements: "",
    missingSuggestions: [],
    rewritten: "",
  };
}
