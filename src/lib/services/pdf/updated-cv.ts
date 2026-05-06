import type { ProfileResult, RewritePreview } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import { createCvBasePdf, wrapText, sanitizeForPdf, shortenLinkedInUrl, COLORS } from "./shared";
import { sanitizeTemplateOutput } from "@/lib/utils/placeholder-detect";

import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

// Wonsulting-style CV section IDs for professionals (experience first)
const PROFESSIONAL_SECTION_ORDER = [
  "contact-info",
  "professional-summary",
  "work-experience",
  "leadership-experience",
  "education-section",
  "skills-section",
  "certifications",
];

// Wonsulting-style CV section IDs for students/entry-level (education first)
const STUDENT_SECTION_ORDER = [
  "contact-info",
  "education-section",
  "work-experience",
  "leadership-experience",
  "professional-summary",
  "skills-section",
  "certifications",
];

// US Letter dimensions in points
const US_LETTER_WIDTH = 612;
const US_LETTER_HEIGHT = 792;
const CV_BLACK = COLORS.text;

/**
 * Detect if profile is student/entry-level.
 */
function isStudentProfile(rewrites: RewritePreview[]): boolean {
  const workExp = rewrites.find((r) => r.sectionId === "work-experience");
  const education = rewrites.find((r) => r.sectionId === "education-section");
  const workEntryCount = workExp?.entries?.length ?? 0;
  if (workEntryCount === 0) return true;
  if (workEntryCount <= 1 && education?.entries && education.entries.length > 0) {
    const eduText = education.rewritten + (education.entries?.map((e) => e.rewritten).join(" ") ?? "");
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear, currentYear - 1, currentYear + 1, currentYear + 2];
    if (recentYears.some((yr) => eduText.includes(String(yr)))) return true;
  }
  return false;
}

function parseEntryTitle(title: string): { company: string; position: string } | null {
  const atMatch = title.match(/^(.+?)\s+(?:at|@|en)\s+(.+)$/i);
  if (atMatch) return { position: atMatch[1], company: atMatch[2] };
  return null;
}

function parseOrgLocation(org: string): { name: string; location: string | null } {
  const dashMatch = org.match(/^(.+?)\s*[-\u2013\u2014]\s*([A-Z][a-zA-Z\s]+,\s*[A-Z]{2,}.*)$/);
  if (dashMatch) return { name: dashMatch[1].trim(), location: dashMatch[2].trim() };
  const commaMatch = org.match(/^(.+?),\s*([A-Z][a-zA-Z\s]+,\s*[A-Z]{2,}.*)$/);
  if (commaMatch) return { name: commaMatch[1].trim(), location: commaMatch[2].trim() };
  return { name: org, location: null };
}

function stripLeadingSectionTitle(text: string, sectionLabel: string): string {
  const lines = text.split("\n");
  if (lines.length === 0) return text;
  const firstLine = lines[0].trim().replace(/[:#\-*]+$/, "").trim();
  const normalizedLabel = sectionLabel.toLowerCase().replace(/[^a-z0-9\s]/gi, "").trim();
  const normalizedFirst = firstLine.toLowerCase().replace(/[^a-z0-9\s]/gi, "").trim();
  if (normalizedFirst === normalizedLabel) {
    return lines.slice(1).join("\n").trimStart();
  }
  return text;
}

/**
 * PHASE 4.2: Generate an Updated CV PDF — Wonsulting Style
 *
 * US Letter (8.5" x 11"), 72pt margins, Times New Roman.
 * Name 18pt bold centered, contact 11pt, HR, section headings ALL CAPS bold underlined.
 * Entries: Company+Location bold, Position+Dates italic right-aligned.
 * Bullets: 10pt, 18pt indent. ATS-friendly: no tables/images/columns, pure black.
 */
export async function generateUpdatedCvPdf(
  results: ProfileResult,
  language: string
): Promise<Uint8Array> {
  const { doc, fontRegular, fontBold, fontItalic } = await createCvBasePdf();
  const labels = i18nMap[language] ?? i18nMap.en;
  const margin = 72;
  const pageWidth = US_LETTER_WIDTH;
  const contentWidth = pageWidth - margin * 2;

  const isStudent = isStudentProfile(results.cvRewrites);
  const sectionOrder = isStudent ? STUDENT_SECTION_ORDER : PROFESSIONAL_SECTION_ORDER;

  let page = doc.addPage([US_LETTER_WIDTH, US_LETTER_HEIGHT]);
  let y = page.getHeight() - margin;

  function ensureSpace(needed: number) {
    if (y < needed) {
      page = doc.addPage([US_LETTER_WIDTH, US_LETTER_HEIGHT]);
      y = page.getHeight() - margin;
    }
  }

  function drawCentered(text: string, fontSize: number, font: typeof fontRegular) {
    const sanitized = sanitizeForPdf(text);
    const textWidth = font.widthOfTextAtSize(sanitized, fontSize);
    const x = (pageWidth - textWidth) / 2;
    page.drawText(sanitized, { x: Math.max(margin, x), y, size: fontSize, font, color: CV_BLACK });
  }

  function drawRightAligned(text: string, fontSize: number, font: typeof fontRegular) {
    const sanitized = sanitizeForPdf(text);
    const textWidth = font.widthOfTextAtSize(sanitized, fontSize);
    page.drawText(sanitized, { x: pageWidth - margin - textWidth, y, size: fontSize, font, color: CV_BLACK });
  }

  // Order rewrites
  const orderedRewrites = sectionOrder
    .map((id) => results.cvRewrites.find((r) => r.sectionId === id))
    .filter(Boolean) as RewritePreview[];
  const orderedIds = new Set(sectionOrder);
  const extraRewrites = results.cvRewrites.filter((r) => !orderedIds.has(r.sectionId));
  const allRewrites = [...orderedRewrites, ...extraRewrites];

  // ── Header ──
  const contactRewrite = allRewrites.find((r) => r.sectionId === "contact-info");

  if (contactRewrite) {
    const cleanedContact = sanitizeTemplateOutput(contactRewrite.rewritten);
    const contactLines = cleanedContact.split("\n").filter(Boolean);

    const HEADER_EXCLUDE_RE = /^(objective|professional\s*(goal|growth|summary|profile)|career\s*(objective|goal|summary)|seeking\s|driven\s|passionate\s|results.driven|goal.oriented|looking\s*(for|to)|summary\s*[|:])/i;
    const SEPARATOR_ONLY_RE = /^\s*[|,;\-\u2013\u2014]+\s*$/;
    const CONTACT_PATTERN_RE = /(@|phone|\+?\d[\d\s\-().]{5,}|linkedin\.com|github\.com|\.com\b|[A-Z][a-z]+,\s*[A-Z]{2})/i;
    const filteredContactLines = contactLines.filter((line, idx) => {
      const trimmed = line.trim();
      if (HEADER_EXCLUDE_RE.test(trimmed)) return false;
      if (SEPARATOR_ONLY_RE.test(trimmed)) return false;
      if (/^objective\s*[|:]/i.test(trimmed)) return false;
      if (idx === 0) return true;
      if (trimmed.length > 80 && !CONTACT_PATTERN_RE.test(trimmed)) return false;
      return true;
    });

    // Name: 18pt bold, centered
    const nameText = filteredContactLines.length > 0 && filteredContactLines[0].trim().length > 0
      ? filteredContactLines[0] : "Candidate";
    drawCentered(nameText, 18, fontBold);
    y -= 22;

    // Contact line: 11pt, centered
    if (filteredContactLines.length > 1) {
      const hasLinkedInUrl = filteredContactLines.some((l) => /linkedin\.com\/in\//i.test(l));
      const deduped = hasLinkedInUrl
        ? filteredContactLines.filter((l) => !/^\s*linkedin\s*$/i.test(l.trim()))
        : filteredContactLines;
      const contactText = shortenLinkedInUrl(deduped.slice(1).join(" | "));
      drawCentered(contactText, 11, fontRegular);
      y -= 16;
    }

    // Horizontal rule
    y -= 4;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: CV_BLACK });
    y -= 12;
  } else {
    drawCentered("Candidate", 18, fontBold);
    y -= 22;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: CV_BLACK });
    y -= 12;
  }

  // ── Sections ──
  for (const rewrite of allRewrites) {
    if (rewrite.sectionId === "contact-info") continue;
    ensureSpace(80);

    const label = getSectionLabel(rewrite.sectionId, labels);

    // Section heading: 10pt bold, ALL CAPS, underlined
    page.drawText(sanitizeForPdf(label.toUpperCase()), { x: margin, y, size: 10, font: fontBold, color: CV_BLACK });
    y -= 3;
    page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: CV_BLACK });
    y -= 8;

    const cleanedRewritten = sanitizeTemplateOutput(stripLeadingSectionTitle(rewrite.rewritten, label));

    // ── Entry-level rendering ──
    if (rewrite.entries && rewrite.entries.length > 0) {
      for (const entry of rewrite.entries) {
        ensureSpace(60);
        const org = entry.organization ?? "";
        const titleRole = entry.title ?? "";
        const dateRange = entry.dateRange ?? "";

        if (org) {
          const orgParts = parseOrgLocation(org);
          // Line 1: Company (bold left) + Location (bold right)
          page.drawText(sanitizeForPdf(orgParts.name), { x: margin, y, size: 10, font: fontBold, color: CV_BLACK });
          if (orgParts.location) drawRightAligned(orgParts.location, 10, fontBold);
          y -= 12;

          // Line 2: Position (italic left) + Dates (italic right)
          if (titleRole || dateRange) {
            if (titleRole) page.drawText(sanitizeForPdf(titleRole), { x: margin, y, size: 10, font: fontItalic, color: CV_BLACK });
            if (dateRange) drawRightAligned(dateRange, 10, fontItalic);
            y -= 12;
          }
        } else {
          const parsed = parseEntryTitle(entry.entryTitle);
          if (parsed) {
            for (const line of wrapText(sanitizeForPdf(parsed.company), fontBold, 10, contentWidth)) {
              ensureSpace(40);
              page.drawText(line, { x: margin, y, size: 10, font: fontBold, color: CV_BLACK });
              y -= 12;
            }
            for (const line of wrapText(sanitizeForPdf(parsed.position), fontItalic, 10, contentWidth)) {
              ensureSpace(40);
              page.drawText(line, { x: margin, y, size: 10, font: fontItalic, color: CV_BLACK });
              y -= 12;
            }
          } else {
            for (const line of wrapText(sanitizeForPdf(entry.entryTitle), fontBold, 10, contentWidth)) {
              ensureSpace(40);
              page.drawText(line, { x: margin, y, size: 10, font: fontBold, color: CV_BLACK });
              y -= 12;
            }
          }
        }

        // Bullet points
        const cleanedEntry = sanitizeTemplateOutput(stripLeadingSectionTitle(entry.rewritten, entry.entryTitle));
        const bulletIndent = 18;
        for (const rawLine of cleanedEntry.split("\n").filter(Boolean)) {
          const isBullet = rawLine.trimStart().startsWith("-") || rawLine.trimStart().startsWith("*");
          const cleanLine = isBullet ? rawLine.trimStart().replace(/^[-*]\s*/, "") : rawLine;
          const wrappedLines = wrapText(sanitizeForPdf(cleanLine), fontRegular, 10, contentWidth - bulletIndent);
          for (let i = 0; i < wrappedLines.length; i++) {
            ensureSpace(40);
            if (i === 0 && isBullet) {
              page.drawText("-", { x: margin + 8, y, size: 10, font: fontRegular, color: CV_BLACK });
            }
            page.drawText(wrappedLines[i], { x: margin + bulletIndent, y, size: 10, font: fontRegular, color: CV_BLACK });
            y -= 11;
          }
        }
        y -= 6;
      }
    } else {
      // ── Section-level content ──
      if (rewrite.sectionId === "skills-section") {
        const skillsLabel = language === "es" ? "Habilidades:" : "Skills:";
        const boldWidth = fontBold.widthOfTextAtSize(sanitizeForPdf(skillsLabel), 10);
        const skillsText = sanitizeForPdf(cleanedRewritten);
        const prefixLines = wrapText(skillsText, fontRegular, 10, contentWidth - boldWidth - 4);
        if (prefixLines.length > 0) {
          ensureSpace(40);
          page.drawText(sanitizeForPdf(skillsLabel), { x: margin, y, size: 10, font: fontBold, color: CV_BLACK });
          page.drawText(prefixLines[0], { x: margin + boldWidth + 4, y, size: 10, font: fontRegular, color: CV_BLACK });
          y -= 12;
        }
        const firstLineText = prefixLines[0] ?? "";
        const remainder = skillsText.slice(firstLineText.length).trimStart();
        if (remainder.length > 0) {
          for (const line of wrapText(remainder, fontRegular, 10, contentWidth)) {
            ensureSpace(40);
            page.drawText(line, { x: margin, y, size: 10, font: fontRegular, color: CV_BLACK });
            y -= 12;
          }
        }
      } else {
        for (const para of cleanedRewritten.split("\n").filter(Boolean)) {
          for (const line of wrapText(sanitizeForPdf(para), fontRegular, 10, contentWidth)) {
            ensureSpace(40);
            page.drawText(line, { x: margin, y, size: 10, font: fontRegular, color: CV_BLACK });
            y -= 12;
          }
          y -= 3;
        }
      }
    }
    y -= 10;
  }

  return doc.save();
}
