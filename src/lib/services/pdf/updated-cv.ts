import type { ProfileResult, RewritePreview } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import { createCvBasePdf, addPage, wrapText, sanitizeForPdf, COLORS } from "./shared";

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
    const contactLines = contactRewrite.rewritten.split("\n").filter(Boolean);
    // First line = name
    if (contactLines.length > 0) {
      drawCentered(contactLines[0], 24, fontBold);
      y -= 28;
    }
    // Remaining lines = contact info (pipe-separated on one line)
    if (contactLines.length > 1) {
      const contactText = contactLines.slice(1).join(" | ");
      drawCentered(contactText, 10, fontRegular);
      y -= 16;
    }
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

        // Entry title (bold)
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

        // Entry content as bullet points
        const lines = entry.rewritten.split("\n").filter(Boolean);
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
      // Skills section: render as "Skills: ..." format
      if (rewrite.sectionId === "skills-section") {
        const skillsText = sanitizeForPdf(rewrite.rewritten);
        const wrappedLines = wrapText(skillsText, fontRegular, 10, contentWidth);
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
      } else {
        // General sections: wrapped paragraphs
        const paragraphs = rewrite.rewritten.split("\n").filter(Boolean);
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
