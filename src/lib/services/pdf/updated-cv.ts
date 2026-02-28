import type { ProfileResult, RewritePreview } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import { createCvBasePdf, addPage, wrapText, sanitizeForPdf, COLORS } from "./shared";
import { stripPlaceholders, sanitizeTemplateOutput } from "@/lib/utils/placeholder-detect";

import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

// Ordered CV section IDs for ATS-friendly layout
const CV_SECTION_ORDER = [
  "contact-info",
  "professional-summary",
  "work-experience",
  "education-section",
  "skills-section",
  "certifications",
];

// Black for CV (professional template style)
const CV_BLACK = COLORS.text;
const CV_MUTED = COLORS.textMuted;

/**
 * Parse entry title for "Position at Company" pattern.
 * Returns company (line 1, bold) and position (line 2, italic) if parseable.
 */
function parseEntryTitle(title: string): { company: string; position: string } | null {
  const atMatch = title.match(/^(.+?)\s+(?:at|@|en)\s+(.+)$/i);
  if (atMatch) return { position: atMatch[1], company: atMatch[2] };
  return null;
}

/**
 * HOTFIX-4: Strip LLM-generated section title from rewritten text.
 * Sometimes the LLM repeats the section heading as the first line of the rewritten content.
 * This prevents that duplication from appearing in the PDF.
 */
function stripLeadingSectionTitle(text: string, sectionLabel: string): string {
  const lines = text.split("\n");
  if (lines.length === 0) return text;
  const firstLine = lines[0].trim().replace(/[:#\-*]+$/, "").trim();
  const normalizedLabel = sectionLabel.toLowerCase().replace(/[^a-z0-9\s]/gi, "").trim();
  const normalizedFirst = firstLine.toLowerCase().replace(/[^a-z0-9\s]/gi, "").trim();
  if (
    normalizedFirst === normalizedLabel ||
    normalizedFirst === normalizedLabel.toUpperCase().toLowerCase()
  ) {
    return lines.slice(1).join("\n").trimStart();
  }
  return text;
}

/**
 * Generate an Updated CV PDF matching professional CV template style.
 *
 * Layout:
 * - Times New Roman font family
 * - 72pt margins (1 inch)
 * - Centered name (24pt bold) + centered contact line
 * - Section headings: uppercase, bold, underlined
 * - Experience/Education entries: bold title + bullet points
 * - Skills as inline text
 */
export async function generateUpdatedCvPdf(
  results: ProfileResult,
  language: string
): Promise<Uint8Array> {
  const { doc, fontRegular, fontBold, fontItalic } = await createCvBasePdf();
  const labels = i18nMap[language] ?? i18nMap.en;
  const margin = 72; // 1 inch margins (template spec)
  const pageWidth = 595.28;
  const contentWidth = pageWidth - margin * 2;

  let page = addPage(doc);
  let y = page.getHeight() - margin;

  // ── Helpers ──
  function ensureSpace(needed: number) {
    if (y < needed) {
      page = addPage(doc);
      y = page.getHeight() - margin;
    }
  }

  function drawCentered(
    text: string,
    fontSize: number,
    font: typeof fontRegular
  ) {
    const sanitized = sanitizeForPdf(text);
    const textWidth = font.widthOfTextAtSize(sanitized, fontSize);
    const x = (pageWidth - textWidth) / 2;
    page.drawText(sanitized, {
      x: Math.max(margin, x),
      y,
      size: fontSize,
      font,
      color: CV_BLACK,
    });
  }

  // ── Order rewrites ──
  const orderedRewrites = CV_SECTION_ORDER.map((id) =>
    results.cvRewrites.find((r) => r.sectionId === id)
  ).filter(Boolean) as RewritePreview[];

  // Add any extra sections not in the order
  const orderedIds = new Set(CV_SECTION_ORDER);
  const extraRewrites = results.cvRewrites.filter(
    (r) => !orderedIds.has(r.sectionId)
  );
  const allRewrites = [...orderedRewrites, ...extraRewrites];

  // ── Header: Name + Contact Info ──
  const contactRewrite = allRewrites.find((r) => r.sectionId === "contact-info");

  if (contactRewrite) {
    const cleanedContact = sanitizeTemplateOutput(contactRewrite.rewritten);
    const contactLines = cleanedContact.split("\n").filter(Boolean);
    // First line = name (fallback to "Candidate" if missing)
    const nameText = contactLines.length > 0 && contactLines[0].trim().length > 0
      ? contactLines[0]
      : "Candidate";
    drawCentered(nameText, 24, fontBold);
    y -= 28;
    // Remaining lines = contact info (pipe-separated on one line)
    if (contactLines.length > 1) {
      const contactText = contactLines.slice(1).join(" | ");
      drawCentered(contactText, 10, fontRegular);
      y -= 16;
    }
  } else {
    // No contact-info section at all — use fallback name
    drawCentered("Candidate", 24, fontBold);
    y -= 28;
  }

  // ── Sections ──
  for (const rewrite of allRewrites) {
    // Skip contact-info (already rendered as header)
    if (rewrite.sectionId === "contact-info") continue;

    ensureSpace(80);

    // ── Section heading: UPPERCASE, bold, underlined ──
    const label = getSectionLabel(rewrite.sectionId, labels);
    page.drawText(sanitizeForPdf(label.toUpperCase()), {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: CV_BLACK,
    });
    y -= 3;

    // Underline (0.5pt border-bottom matching template)
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: CV_BLACK,
    });
    y -= 12;

    // ── Entry-level rendering (work-experience, education-section) ──
    if (rewrite.entries && rewrite.entries.length > 0) {
      for (const entry of rewrite.entries) {
        ensureSpace(60);

        // Structured entry rendering: organization > title > dateRange
        if (entry.organization) {
          // Line 1: Organization (bold)
          const orgLines = wrapText(
            sanitizeForPdf(entry.organization),
            fontBold,
            10,
            contentWidth
          );
          for (const line of orgLines) {
            ensureSpace(40);
            page.drawText(line, {
              x: margin,
              y,
              size: 10,
              font: fontBold,
              color: CV_BLACK,
            });
            y -= 12;
          }
          // Line 2: Title/Role/Degree (italic)
          if (entry.title) {
            const titleRoleLines = wrapText(
              sanitizeForPdf(entry.title),
              fontItalic,
              10,
              contentWidth
            );
            for (const line of titleRoleLines) {
              ensureSpace(40);
              page.drawText(line, {
                x: margin,
                y,
                size: 10,
                font: fontItalic,
                color: CV_BLACK,
              });
              y -= 12;
            }
          }
          // Line 3: Date range (regular, muted)
          if (entry.dateRange) {
            ensureSpace(40);
            page.drawText(sanitizeForPdf(entry.dateRange), {
              x: margin,
              y,
              size: 9,
              font: fontRegular,
              color: CV_BLACK,
            });
            y -= 12;
          }
        } else {
          // Fallback: regex-based parsing for old cached results without structured fields
          const parsed = parseEntryTitle(entry.entryTitle);
          if (parsed) {
            // Line 1: Company/Organization (bold)
            const companyLines = wrapText(
              sanitizeForPdf(parsed.company),
              fontBold,
              10,
              contentWidth
            );
            for (const line of companyLines) {
              ensureSpace(40);
              page.drawText(line, {
                x: margin,
                y,
                size: 10,
                font: fontBold,
                color: CV_BLACK,
              });
              y -= 12;
            }
            // Line 2: Position (italic)
            const positionLines = wrapText(
              sanitizeForPdf(parsed.position),
              fontItalic,
              10,
              contentWidth
            );
            for (const line of positionLines) {
              ensureSpace(40);
              page.drawText(line, {
                x: margin,
                y,
                size: 10,
                font: fontItalic,
                color: CV_BLACK,
              });
              y -= 12;
            }
          } else {
            // Fallback: single bold title line
            const titleLines = wrapText(
              sanitizeForPdf(entry.entryTitle),
              fontBold,
              10,
              contentWidth
            );
            for (const line of titleLines) {
              ensureSpace(40);
              page.drawText(line, {
                x: margin,
                y,
                size: 10,
                font: fontBold,
                color: CV_BLACK,
              });
              y -= 12;
            }
          }
        }

        // Entry content as bullet points
        // HOTFIX-4: Strip potential duplicated entry title from rewritten text
        // HOTFIX-4C: Strip unresolved placeholder tokens before export
        const cleanedEntryContent = sanitizeTemplateOutput(
          stripLeadingSectionTitle(entry.rewritten, entry.entryTitle)
        );
        const lines = cleanedEntryContent.split("\n").filter(Boolean);
        for (const rawLine of lines) {
          const isBullet = rawLine.trimStart().startsWith("-") || rawLine.trimStart().startsWith("*");
          const cleanLine = isBullet
            ? rawLine.trimStart().replace(/^[-*]\s*/, "")
            : rawLine;

          const bulletIndent = 18; // template spec: 18pt indent
          const wrappedLines = wrapText(
            sanitizeForPdf(cleanLine),
            fontRegular,
            10,
            contentWidth - bulletIndent
          );

          for (let i = 0; i < wrappedLines.length; i++) {
            ensureSpace(40);
            if (i === 0 && isBullet) {
              // Draw bullet character
              page.drawText("-", {
                x: margin + 8,
                y,
                size: 10,
                font: fontRegular,
                color: CV_BLACK,
              });
            }
            page.drawText(wrappedLines[i], {
              x: margin + bulletIndent,
              y,
              size: 10,
              font: fontRegular,
              color: CV_BLACK,
            });
            y -= 11; // line-height 1.0 at 10pt
          }
        }
        y -= 6; // spacing between entries
      }
    } else {
      // ── Section-level content ──
      // HOTFIX-4: Strip LLM-duplicated section titles from rewritten text
      // HOTFIX-4C: Strip unresolved placeholder tokens before export
      const cleanedRewritten = sanitizeTemplateOutput(
        stripLeadingSectionTitle(rewrite.rewritten, label)
      );

      // Skills section: render with bold "Skills:" prefix
      if (rewrite.sectionId === "skills-section") {
        const skillsLabel = language === "es" ? "Habilidades:" : "Skills:";
        const boldWidth = fontBold.widthOfTextAtSize(sanitizeForPdf(skillsLabel), 10);
        const skillsText = sanitizeForPdf(cleanedRewritten);
        const firstLineWidth = contentWidth - boldWidth - 4;

        // Wrap skills text for the first line (after bold prefix) and subsequent lines
        const allSkillsLines = wrapText(skillsText, fontRegular, 10, contentWidth);
        // Re-wrap accounting for bold prefix on first line
        const prefixLines = wrapText(skillsText, fontRegular, 10, firstLineWidth);

        if (prefixLines.length > 0) {
          ensureSpace(40);
          // Draw bold "Skills:" prefix
          page.drawText(sanitizeForPdf(skillsLabel), {
            x: margin,
            y,
            size: 10,
            font: fontBold,
            color: CV_BLACK,
          });
          // Draw first line of skills after prefix
          page.drawText(prefixLines[0], {
            x: margin + boldWidth + 4,
            y,
            size: 10,
            font: fontRegular,
            color: CV_BLACK,
          });
          y -= 12;
        }

        // If first-line wrap consumed less text, re-wrap remainder at full width
        const firstLineText = prefixLines[0] ?? "";
        const remainder = skillsText.slice(firstLineText.length).trimStart();
        if (remainder.length > 0) {
          const remainderLines = wrapText(remainder, fontRegular, 10, contentWidth);
          for (const line of remainderLines) {
            ensureSpace(40);
            page.drawText(line, {
              x: margin,
              y,
              size: 10,
              font: fontRegular,
              color: CV_BLACK,
            });
            y -= 12;
          }
        }
      } else {
        // General sections: wrapped paragraphs
        const paragraphs = cleanedRewritten.split("\n").filter(Boolean);
        for (const para of paragraphs) {
          const wrappedLines = wrapText(sanitizeForPdf(para), fontRegular, 10, contentWidth);
          for (const line of wrappedLines) {
            ensureSpace(40);
            page.drawText(line, {
              x: margin,
              y,
              size: 10,
              font: fontRegular,
              color: CV_BLACK,
            });
            y -= 12;
          }
          y -= 3;
        }
      }
    }

    y -= 10; // spacing between sections
  }

  // ── Footer ──
  const lastPage = doc.getPages()[doc.getPageCount() - 1];
  const footerText =
    language === "es"
      ? "Generado por Profile Score"
      : "Generated by Profile Score";
  lastPage.drawText(sanitizeForPdf(footerText), {
    x: margin,
    y: 30,
    size: 8,
    font: fontRegular,
    color: CV_MUTED,
  });

  return doc.save();
}
