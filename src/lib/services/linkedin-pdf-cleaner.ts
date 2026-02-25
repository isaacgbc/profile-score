/**
 * Pre-parser normalization for LinkedIn PDF text.
 *
 * Removes common PDF noise (contact blocks, sidebar skills/certs,
 * page markers, footer decorations) before section parsing so that
 * the headline and section boundaries are clean.
 *
 * Pure synchronous function — no I/O, no LLM calls.
 */

// ── Result type ──────────────────────────────────────────
export interface PdfCleanerResult {
  /** Cleaned text ready for section parsing */
  cleaned: string;
  /** Metadata extracted during cleaning (preserved, not merged into text) */
  metadata: PdfCleanerMetadata;
}

export interface PdfCleanerMetadata {
  contactLines: string[];
  sidebarSkills: string[];
  certifications: string[];
  removedPageMarkers: number;
}

// ── Patterns ─────────────────────────────────────────────

/** Page markers: "Page 1 of 3", "Página 2 de 5" */
const PAGE_MARKER_RE =
  /^(?:Page|P[aá]gina)\s+\d+\s+(?:of|de)\s+\d+\s*$/i;

/** Contact header lines */
const CONTACT_HEADER_RE =
  /^(?:Contactar|Contact|Contact\s+info|Datos\s+de\s+contacto)\s*$/i;

/** Email pattern */
const EMAIL_RE = /^[\w.+-]+@[\w.-]+\.\w{2,}$/;

/** Phone pattern (7+ digit sequences with optional country code) */
const PHONE_RE = /^[\+]?\(?\d[\d\s\-\(\)\.]{6,}\d$/;

/** URL pattern (standalone URL lines) */
const URL_LINE_RE = /^(?:https?:\/\/|www\.)[\S]+$/i;

/** LinkedIn footer decoration */
const LINKEDIN_FOOTER_RE = /^(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\//i;

/** Sidebar skills header: "Aptitudes principales", "Top Skills", etc. */
const SIDEBAR_SKILLS_HEADER_RE =
  /^(?:Aptitudes\s+principales|Top\s+skills?|Principales\s+aptitudes|Competencias\s+principales)\s*$/i;

/** Sidebar certifications / honors header */
const SIDEBAR_CERTS_HEADER_RE =
  /^(?:Certific(?:ations?|aciones?)|Licenses?\s*&?\s*certific|Honors?\s*(?:&|-)\s*Awards?|Honores?\s*(?:y|&)\s*Premios?)\s*$/i;

/** Known section headers that terminate a sidebar block */
const SECTION_HEADER_RE =
  /^(?:About|Summary|Experience|Education|Skills|Recommendations?|Featured|Activity|Acerca\s+de|Extracto|Experiencia|Educación|Formación|Aptitudes|Habilidades|Recomendaciones?|Destacados?)(?:\s|$)/i;

// ── Cleaner ──────────────────────────────────────────────

export function cleanLinkedinPdfText(rawText: string): PdfCleanerResult {
  const lines = rawText.split("\n");
  const cleaned: string[] = [];
  const metadata: PdfCleanerMetadata = {
    contactLines: [],
    sidebarSkills: [],
    certifications: [],
    removedPageMarkers: 0,
  };

  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Remove page markers
    if (PAGE_MARKER_RE.test(trimmed)) {
      metadata.removedPageMarkers++;
      i++;
      continue;
    }

    // 2. Remove LinkedIn footer decoration lines
    if (LINKEDIN_FOOTER_RE.test(trimmed) && trimmed.length < 80) {
      i++;
      continue;
    }

    // 3. Extract contact block (header + consecutive contact lines)
    if (CONTACT_HEADER_RE.test(trimmed)) {
      metadata.contactLines.push(trimmed);
      i++;
      // Consume following contact-like lines
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next === "") {
          i++;
          break; // blank line ends contact block
        }
        if (SECTION_HEADER_RE.test(next)) break; // section header ends block
        if (
          EMAIL_RE.test(next) ||
          PHONE_RE.test(next) ||
          URL_LINE_RE.test(next) ||
          next.length < 60 // short lines in contact block are likely metadata
        ) {
          metadata.contactLines.push(next);
          i++;
        } else {
          break; // long non-contact line → stop consuming
        }
      }
      continue;
    }

    // 4. Standalone contact-like lines near the top (before first section header)
    // Only strip if we haven't found any section headers yet
    if (
      cleaned.length < 10 && // still near the top
      (EMAIL_RE.test(trimmed) || PHONE_RE.test(trimmed)) &&
      trimmed.length < 80
    ) {
      metadata.contactLines.push(trimmed);
      i++;
      continue;
    }

    // 5. Extract sidebar skills block
    if (SIDEBAR_SKILLS_HEADER_RE.test(trimmed)) {
      i++;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (next === "") {
          i++;
          break;
        }
        if (SECTION_HEADER_RE.test(next)) break;
        if (next.length < 80) {
          metadata.sidebarSkills.push(next);
        }
        i++;
      }
      continue;
    }

    // 6. Extract sidebar certifications block
    if (SIDEBAR_CERTS_HEADER_RE.test(trimmed)) {
      // Check if this is a sidebar block (short lines) vs a real section
      // Sidebar blocks appear before the main sections and have short entries
      const lookaheadLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && j - i < 10) {
        const la = lines[j].trim();
        if (la === "" || SECTION_HEADER_RE.test(la)) break;
        lookaheadLines.push(la);
        j++;
      }
      const avgLen =
        lookaheadLines.length > 0
          ? lookaheadLines.reduce((s, l) => s + l.length, 0) /
            lookaheadLines.length
          : 0;

      // If average line length < 60, it's a sidebar block
      if (avgLen < 60 && lookaheadLines.length > 0) {
        i++;
        while (i < lines.length) {
          const next = lines[i].trim();
          if (next === "") {
            i++;
            break;
          }
          if (SECTION_HEADER_RE.test(next)) break;
          metadata.certifications.push(next);
          i++;
        }
        continue;
      }
    }

    // 7. Keep this line
    cleaned.push(line);
    i++;
  }

  // 8. Collapse 3+ consecutive blank lines → 2
  const collapsed: string[] = [];
  let blankCount = 0;
  for (const line of cleaned) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 2) collapsed.push(line);
    } else {
      blankCount = 0;
      collapsed.push(line);
    }
  }

  return {
    cleaned: collapsed.join("\n"),
    metadata,
  };
}
