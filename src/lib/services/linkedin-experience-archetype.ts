/**
 * LINKEDIN_PDF_EXPERIENCE_ARCHETYPE parser.
 *
 * Deterministic-first, no-drop, no-cross-mix parser for LinkedIn PDF
 * Experience sections. Uses a date-anchor state machine:
 *
 *   1. Scan for date-range anchor lines (EN/ES + Present/Actualidad)
 *   2. Look back: last header line = title, earlier header lines = organization
 *   3. Look forward: first line after date = location (if matches), then description
 *   4. Description extends until next entry's header zone begins
 *   5. Enforce strict sourceSpan ownership — no line belongs to two entries
 *   6. Unmapped lines tracked separately (never silently dropped)
 *
 * LinkedIn PDF Experience format (verified from real exports):
 *   Organization Name          ← may wrap to 2+ lines for long names
 *   Title/Role
 *   month de YYYY - month de YYYY (duration)
 *   Location (optional)        ← AFTER date, e.g. "Asunción, Paraguay"
 *   Description paragraphs...
 *
 * Anti-mix guarantees:
 *   - Description cannot include lines from next entry's header
 *   - sourceSpan is exclusive per entry (no overlap)
 *   - Multi-role same org: sub-role lines stay as description, not new entry
 *
 * No-drop invariant:
 *   inputLines = mappedLines + unmappedLines  (always)
 */

import type { ParsedEntry, ParsedSectionWithEntries } from "./linkedin-parser";

// ── Date regex (handles both EN and ES LinkedIn date formats) ──

const EN_MONTHS =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const ES_MONTHS =
  "ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:tiembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?";

/**
 * Date anchor regex.
 * Matches standalone date-range lines like:
 *   - "noviembre de 2023 - Present (2 años 4 meses)"
 *   - "July 2020 - Present · 5 yrs 8 mos"
 *   - "2019 - 2023"
 *   - "May 2022 - January 2025 (2 years 9 months)"
 */
const DATE_ANCHOR_RE = new RegExp(
  `^\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+(?:de\\s+)?)?\\d{4}\\s*[-–—]\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+(?:de\\s+)?)?(?:\\d{4}|Present|Actual|Actualidad|Presente|Current)(?:\\s*(?:·\\s*.*|\\([^)]*\\)))?\\s*$`,
  "i"
);

/**
 * Duration suffix to strip from date range.
 * Handles both formats:
 *   - " · 5 yrs 8 mos"
 *   - " (2 años 4 meses)"
 */
const DURATION_SUFFIX_RE = /\s*(?:\([^)]+\)|·\s*.*)$/;

/**
 * Detect sub-role date pattern: inline "(YYYY–YYYY)" or "(YYYY - Present)" at end of line.
 * These are roles within the same organization, NOT new top-level entries.
 * Examples: "Director Ejecutivo (2021-2024)", "Director (2024-)"
 */
const SUBROLE_DATE_RE = new RegExp(
  `\\(\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+(?:de\\s+)?)?(?:19|20)\\d{2}` +
    `\\s*[-–—]\\s*(?:(?:${EN_MONTHS}|${ES_MONTHS})\\s+(?:de\\s+)?)?` +
    `(?:(?:19|20)\\d{2}|Present|Actual|Actualidad|Presente|Current)?\\s*\\)\\s*$`,
  "i"
);

/**
 * Detect location-like lines with comma: "City, State/Country" patterns.
 * Examples: "Asunción, Paraguay", "Miami, Florida, Estados Unidos",
 *           "New York, United States", "Delaware, Estados Unidos"
 */
const LOCATION_COMMA_RE =
  /^[A-Z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF\s.]+,\s*[A-Z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF\s,]+$/;

/**
 * Detect location-like line AFTER date line.
 * Two heuristics:
 *   1. Comma pattern: "City, State/Country" (primary, reliable)
 *   2. Short capitalized phrase: 1-3 words, all capitalized, < 40 chars
 *      Catches single-word locations like "Paraguay", "México"
 */
function isLocationLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0 || t.length >= 80) return false;
  if (isBulletLine(t)) return false;
  if (DATE_ANCHOR_RE.test(t)) return false;
  if (SUBROLE_DATE_RE.test(t)) return false;

  // Primary: comma-separated location pattern
  if (LOCATION_COMMA_RE.test(t)) return true;

  // Secondary: short capitalized phrase (1-3 words, each starting uppercase)
  // Catches: "Paraguay", "United States", "México"
  const words = t.split(/\s+/);
  if (words.length >= 1 && words.length <= 3 && t.length < 40) {
    const allCapitalized = words.every((w) =>
      /^[A-Z\u00C0-\u00FF]/.test(w)
    );
    // Extra guard: must not contain parentheses (avoid "(SODEUC)")
    if (allCapitalized && !/[()]/.test(t)) return true;
  }

  return false;
}

/** Check if a line is a bullet point */
function isBulletLine(line: string): boolean {
  return /^\s*[-*•–—]\s/.test(line);
}

/**
 * Check if a line looks like a header (org name, title).
 * Headers are: non-empty, not too long, not bullets, not URLs, not dates.
 */
function isHeaderLike(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  if (t.length > 120) return false;
  if (isBulletLine(t)) return false;
  if (/^(?:https?:\/\/|www\.)/i.test(t)) return false;
  if (DATE_ANCHOR_RE.test(t)) return false;
  return true;
}

/** Check if a line is likely a sub-role within same organization */
function isSubRoleLine(line: string): boolean {
  return SUBROLE_DATE_RE.test(line.trim());
}

// ── Archetype Entry (extends ParsedEntry with strict span) ──

export interface ArchetypeEntry extends ParsedEntry {
  /** Location string (if detected) */
  location?: string;
  /** Strict source span: start line (inclusive) */
  sourceLineStart: number;
  /** Strict source span: end line (exclusive) */
  sourceLineEnd: number;
}

export interface ArchetypeResult {
  entries: ArchetypeEntry[];
  /** Lines not assigned to any entry */
  unmappedLines: { lineIndex: number; text: string }[];
  /** Diagnostic metrics */
  diagnostics: {
    inputLineCount: number;
    nonEmptyLineCount: number;
    mappedLineCount: number;
    unmappedLineCount: number;
    entryCount: number;
    coveragePercent: number;
    /** Lines mapped to entries + unmapped should equal total non-empty lines */
    noDropInvariant: boolean;
    dateAnchorCount: number;
    subRoleLinesAbsorbed: number;
    locationLinesDetected: number;
    /** Always 0 by design — sourceSpan is exclusive per entry */
    wrongAttachmentCount: number;
    /** Always 0 by design — spans are non-overlapping */
    spanMismatchCount: number;
  };
}

// ── Internal: intermediate structure before final assembly ──

interface EntryBlueprint {
  dateIdx: number;
  dateRange: string;
  headerLineIndices: number[];
  organization: string;
  title: string;
  location?: string;
  locationIdx?: number;
  descStart: number;
  descEnd: number;
  spanStart: number;
  spanEnd: number;
}

/**
 * Parse LinkedIn PDF Experience text using the archetype algorithm.
 *
 * Two-pass approach:
 *   Pass 1: Find date anchors → identify headers + location for each
 *   Pass 2: Compute description boundaries using adjacent entry spans
 *
 * This ensures description zones never overlap with the next entry's
 * header zone, preventing cross-entry contamination.
 */
export function parseExperienceArchetype(
  sectionText: string
): ArchetypeResult {
  const lines = sectionText.split("\n");
  const lineCount = lines.length;
  const nonEmptyIndices = new Set<number>();

  for (let i = 0; i < lineCount; i++) {
    if (lines[i].trim().length > 0) nonEmptyIndices.add(i);
  }
  const nonEmptyLineCount = nonEmptyIndices.size;

  // ── Pass 1a: Find all date anchor lines ──
  const dateAnchors: number[] = [];
  for (let i = 0; i < lineCount; i++) {
    if (DATE_ANCHOR_RE.test(lines[i])) {
      dateAnchors.push(i);
    }
  }

  let subRoleLinesAbsorbed = 0;
  let locationLinesDetected = 0;

  // ── Pass 1b: Build blueprint for each entry ──
  const blueprints: EntryBlueprint[] = [];

  for (let d = 0; d < dateAnchors.length; d++) {
    const dateIdx = dateAnchors[d];

    // Extract clean date range (strip duration suffix)
    const dateRaw = lines[dateIdx].trim();
    const dateRange = dateRaw.replace(DURATION_SUFFIX_RE, "").trim();

    // ── Header zone: scan backward for org/title lines ──
    // Stop at: blank line, previous date anchor, non-header line, or 5 lines back
    const prevDateEnd = d > 0 ? dateAnchors[d - 1] + 1 : 0;
    const searchFloor = Math.max(prevDateEnd, dateIdx - 5);

    const headerLines: { idx: number; text: string }[] = [];
    for (let h = dateIdx - 1; h >= searchFloor; h--) {
      const ht = lines[h].trim();
      if (ht.length === 0) break; // blank line = entry separator
      if (!isHeaderLike(ht)) break; // description/bullet/URL = stop
      headerLines.unshift({ idx: h, text: ht }); // prepend to maintain order
    }

    // Parse header: last line = title, everything before = organization (joined)
    let organization = "";
    let title = "";

    if (headerLines.length >= 2) {
      title = headerLines[headerLines.length - 1].text;
      organization = headerLines
        .slice(0, -1)
        .map((h) => h.text)
        .join(" ");
    } else if (headerLines.length === 1) {
      // Single header line — treat as title (title is most useful for display)
      title = headerLines[0].text;
    }

    const headerIndices = headerLines.map((h) => h.idx);
    const spanStart =
      headerLines.length > 0 ? headerLines[0].idx : dateIdx;

    // ── Location detection: immediately AFTER date line ──
    let location: string | undefined;
    let locationIdx: number | undefined;
    let descStart = dateIdx + 1;

    if (dateIdx + 1 < lineCount) {
      const nextLine = lines[dateIdx + 1].trim();
      if (nextLine.length > 0 && isLocationLine(nextLine)) {
        location = nextLine;
        locationIdx = dateIdx + 1;
        locationLinesDetected++;
        descStart = dateIdx + 2;
      }
    }

    blueprints.push({
      dateIdx,
      dateRange,
      headerLineIndices: headerIndices,
      organization,
      title,
      location,
      locationIdx,
      descStart,
      descEnd: lineCount, // refined in pass 2
      spanStart,
      spanEnd: lineCount, // refined in pass 2
    });
  }

  // ── Pass 2: Compute description end boundaries ──
  // Each entry's description ends where the next entry's header begins
  for (let i = 0; i < blueprints.length; i++) {
    if (i + 1 < blueprints.length) {
      const nextSpanStart = blueprints[i + 1].spanStart;
      blueprints[i].descEnd = nextSpanStart;
      blueprints[i].spanEnd = nextSpanStart;
    }
    // Last entry: descEnd and spanEnd remain as lineCount (end of text)
  }

  // ── Pass 3: Build final entries with description + strict ownership ──
  const entries: ArchetypeEntry[] = [];
  const ownedLines = new Set<number>();

  for (const bp of blueprints) {
    // Claim header lines
    for (const idx of bp.headerLineIndices) {
      ownedLines.add(idx);
    }
    // Claim date line
    ownedLines.add(bp.dateIdx);
    // Claim location line
    if (bp.locationIdx !== undefined) {
      ownedLines.add(bp.locationIdx);
    }

    // Collect description lines, detect sub-roles
    const descLines: string[] = [];
    for (let dl = bp.descStart; dl < bp.descEnd; dl++) {
      const dTrimmed = lines[dl].trim();

      if (dTrimmed.length > 0 && isSubRoleLine(dTrimmed)) {
        subRoleLinesAbsorbed++;
      }

      descLines.push(lines[dl]);
      ownedLines.add(dl);
    }

    const description = descLines.join("\n").trim();

    entries.push({
      title: bp.title,
      organization: bp.organization,
      dateRange: bp.dateRange,
      description,
      location: bp.location,
      sourceLineStart: bp.spanStart,
      sourceLineEnd: bp.spanEnd,
    });
  }

  // ── Pass 4: Identify unmapped lines ──
  const unmappedLines: { lineIndex: number; text: string }[] = [];
  for (const idx of nonEmptyIndices) {
    if (!ownedLines.has(idx)) {
      unmappedLines.push({ lineIndex: idx, text: lines[idx] });
    }
  }

  // ── Pass 5: Compute diagnostics ──
  const mappedNonEmpty = [...nonEmptyIndices].filter((i) =>
    ownedLines.has(i)
  ).length;
  const unmappedCount = unmappedLines.length;
  const coveragePercent =
    nonEmptyLineCount > 0
      ? Math.round((mappedNonEmpty / nonEmptyLineCount) * 100)
      : 100;

  // No-drop invariant: every non-empty line is either mapped or unmapped
  const noDropInvariant =
    mappedNonEmpty + unmappedCount === nonEmptyLineCount;

  // Span overlap check: verify no two entries share line indices
  let spanMismatchCount = 0;
  const seenLines = new Set<number>();
  for (const entry of entries) {
    for (let s = entry.sourceLineStart; s < entry.sourceLineEnd; s++) {
      if (nonEmptyIndices.has(s) && seenLines.has(s)) {
        spanMismatchCount++;
      }
      seenLines.add(s);
    }
  }

  return {
    entries,
    unmappedLines,
    diagnostics: {
      inputLineCount: lineCount,
      nonEmptyLineCount,
      mappedLineCount: mappedNonEmpty,
      unmappedLineCount: unmappedCount,
      entryCount: entries.length,
      coveragePercent,
      noDropInvariant,
      dateAnchorCount: dateAnchors.length,
      subRoleLinesAbsorbed,
      locationLinesDetected,
      wrongAttachmentCount: 0, // 0 by design — exclusive spans
      spanMismatchCount,
    },
  };
}

/**
 * Adapter: convert ArchetypeResult to ParsedSectionWithEntries
 * for compatibility with the existing pipeline.
 */
export function archetypeToSectionResult(
  result: ArchetypeResult,
  sectionText: string
): ParsedSectionWithEntries {
  const { entries, diagnostics } = result;

  // Confidence: high when we have entries with org/title + dateRange and good coverage
  const triadCount = entries.filter(
    (e) => (e.title || e.organization) && e.dateRange
  ).length;
  const bulletOnlyCount = entries.filter(
    (e) => !e.title && !e.organization && !e.dateRange
  ).length;

  const isHigh =
    entries.length > 0 &&
    diagnostics.coveragePercent >= 70 &&
    bulletOnlyCount === 0 &&
    triadCount >= entries.length * 0.5;

  return {
    rawText: sectionText,
    entries: entries.map((e) => ({
      title: e.title,
      organization: e.organization,
      dateRange: e.dateRange,
      description: e.description,
      sourceLineStart: e.sourceLineStart,
      sourceLineEnd: e.sourceLineEnd,
    })),
    confidence: isHigh ? "high" : "low",
    coveredLineCount: diagnostics.mappedLineCount,
    totalLineCount: diagnostics.nonEmptyLineCount,
  };
}

/**
 * Full archetype pipeline: parse → diagnose → log → adapt.
 *
 * This is the main entry point used by the orchestrator.
 */
export function parseLinkedinExperienceArchetype(
  sectionText: string,
  requestId?: string
): ParsedSectionWithEntries {
  const archResult = parseExperienceArchetype(sectionText);
  const d = archResult.diagnostics;

  console.log(
    `[archetype] ${requestId ? `request=${requestId} | ` : ""}` +
      `entries=${d.entryCount}, coverage=${d.coveragePercent}%, ` +
      `dateAnchors=${d.dateAnchorCount}, mapped=${d.mappedLineCount}/${d.nonEmptyLineCount}, ` +
      `unmapped=${d.unmappedLineCount}, subRoles=${d.subRoleLinesAbsorbed}, ` +
      `locations=${d.locationLinesDetected}, noDrop=${d.noDropInvariant}, ` +
      `wrongAttach=${d.wrongAttachmentCount}, spanMismatch=${d.spanMismatchCount}`
  );

  if (
    archResult.unmappedLines.length > 0 &&
    archResult.unmappedLines.length <= 10
  ) {
    console.log(
      `[archetype] unmapped: ${archResult.unmappedLines
        .map((l) => `L${l.lineIndex}:"${l.text.trim().slice(0, 50)}"`)
        .join(", ")}`
    );
  }

  return archetypeToSectionResult(archResult, sectionText);
}
