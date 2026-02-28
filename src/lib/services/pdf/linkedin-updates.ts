import type { ProfileResult } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import { createBasePdf, addPage, wrapText, sanitizeForPdf, COLORS } from "./shared";
import { stripPlaceholders } from "@/lib/utils/placeholder-detect";

import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

// Ordered LinkedIn section IDs for display
const LINKEDIN_SECTION_ORDER = [
  "headline", "summary", "experience", "education", "skills",
  "certifications", "recommendations", "featured", "projects",
  "volunteer", "honors", "publications",
];

/**
 * Generate a LinkedIn Optimized Sections PDF.
 *
 * Shows ONLY the optimized/rewritten content (no original, no improvements).
 * For experience/education with entries, renders each entry item-by-item.
 */
export async function generateLinkedinUpdatesPdf(
  results: ProfileResult,
  language: string
): Promise<Uint8Array> {
  const { doc, fontRegular, fontBold } = await createBasePdf();
  const labels = i18nMap[language] ?? i18nMap.en;
  const margin = 50;
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

  // ── Title ──
  const title =
    language === "es"
      ? "LinkedIn - Secciones Optimizadas"
      : "LinkedIn - Optimized Sections";
  page.drawText(sanitizeForPdf(title), {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: COLORS.primary,
  });
  y -= 15;

  // Date
  const dateStr = new Date().toLocaleDateString(
    language === "es" ? "es-ES" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );
  page.drawText(sanitizeForPdf(dateStr), {
    x: margin,
    y,
    size: 9,
    font: fontRegular,
    color: COLORS.textMuted,
  });
  y -= 30;

  // ── Order and filter rewrites ──
  const rewrites = LINKEDIN_SECTION_ORDER
    .map((id) => results.linkedinRewrites.find((r) => r.sectionId === id))
    .filter(Boolean)
    .filter((r) => !r!.locked);

  // Add any remaining rewrites not in the order list
  const orderedIds = new Set(LINKEDIN_SECTION_ORDER);
  const extraRewrites = results.linkedinRewrites.filter(
    (r) => !orderedIds.has(r.sectionId) && !r.locked
  );
  const allRewrites = [...rewrites, ...extraRewrites];

  if (allRewrites.length === 0) {
    const noContent =
      language === "es"
        ? "No hay secciones optimizadas disponibles."
        : "No optimized sections available.";
    page.drawText(sanitizeForPdf(noContent), {
      x: margin,
      y,
      size: 11,
      font: fontRegular,
      color: COLORS.textMuted,
    });
  }

  for (const rewrite of allRewrites) {
    if (!rewrite) continue;

    ensureSpace(120);

    // ── Section heading ──
    const label = getSectionLabel(rewrite.sectionId, labels);
    page.drawText(sanitizeForPdf(label.toUpperCase()), {
      x: margin,
      y,
      size: 12,
      font: fontBold,
      color: COLORS.primary,
    });
    y -= 5;

    // Underline
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: COLORS.border,
    });
    y -= 18;

    // ── Entry-level rendering (experience/education) ──
    if (rewrite.entries && rewrite.entries.length > 0) {
      console.log(`[export] ${rewrite.sectionId}: rendering ${rewrite.entries.length} entries`);
      for (let entryIndex = 0; entryIndex < rewrite.entries.length; entryIndex++) {
        const entry = rewrite.entries[entryIndex];
        ensureSpace(100);

        // Separator line between entries (not before first) — HOTFIX-3/4: visible separator
        if (entryIndex > 0) {
          y -= 4;
          page.drawLine({
            start: { x: margin + 10, y: y + 4 },
            end: { x: pageWidth - margin - 10, y: y + 4 },
            thickness: 0.5,
            color: COLORS.border,
          });
          y -= 10;
        }

        // Structured entry rendering: organization > title > dateRange
        if (entry.organization) {
          // Line 1: Organization (bold)
          const orgLines = wrapText(sanitizeForPdf(entry.organization), fontBold, 11, contentWidth);
          for (const line of orgLines) {
            ensureSpace(50);
            page.drawText(line, {
              x: margin + 5,
              y,
              size: 11,
              font: fontBold,
              color: COLORS.text,
            });
            y -= 15;
          }
          // Line 2: Title/Role (regular, smaller)
          if (entry.title) {
            const titleLines = wrapText(sanitizeForPdf(entry.title), fontRegular, 10, contentWidth);
            for (const line of titleLines) {
              ensureSpace(50);
              page.drawText(line, {
                x: margin + 5,
                y,
                size: 10,
                font: fontRegular,
                color: COLORS.textMuted,
              });
              y -= 14;
            }
          }
          // Line 3: Date range (muted)
          if (entry.dateRange) {
            ensureSpace(40);
            page.drawText(sanitizeForPdf(entry.dateRange), {
              x: margin + 5,
              y,
              size: 9,
              font: fontRegular,
              color: COLORS.textMuted,
            });
            y -= 12;
          }
        } else {
          // Fallback: regex-based parsing for old cached results without structured fields
          const titleText = sanitizeForPdf(entry.entryTitle);
          const atMatch = titleText.match(/^(.+?)\s+at\s+(.+)$/i);
          const enMatch = titleText.match(/^(.+?)\s+en\s+(.+)$/i);
          const parsed = atMatch ?? enMatch;

          if (parsed) {
            // Position (bold)
            const positionLines = wrapText(parsed[1].trim(), fontBold, 11, contentWidth);
            for (const line of positionLines) {
              ensureSpace(50);
              page.drawText(line, {
                x: margin + 5,
                y,
                size: 11,
                font: fontBold,
                color: COLORS.text,
              });
              y -= 15;
            }
            // Company (regular, smaller)
            const companyLines = wrapText(parsed[2].trim(), fontRegular, 10, contentWidth);
            for (const line of companyLines) {
              ensureSpace(50);
              page.drawText(line, {
                x: margin + 5,
                y,
                size: 10,
                font: fontRegular,
                color: COLORS.textMuted,
              });
              y -= 14;
            }
          } else {
            // Fallback: render full title bold
            const fallbackLines = wrapText(titleText, fontBold, 11, contentWidth);
            for (const line of fallbackLines) {
              ensureSpace(50);
              page.drawText(line, {
                x: margin + 5,
                y,
                size: 11,
                font: fontBold,
                color: COLORS.text,
              });
              y -= 16;
            }
          }

          // Extract date/location from original text (fallback for old results)
          if (!entry.dateRange) {
            const originalFirstLine = entry.original.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
            const dateLocMatch = originalFirstLine.match(
              /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Ene|Abr|Ago|Dic)[a-z]*\.?\s+\d{4}|(?:19|20)\d{2})\s*[-–]\s*(?:Present|Actual|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Ene|Abr|Ago|Dic)[a-z]*\.?\s+\d{4}|(?:19|20)\d{2})(?:\s*[·|,]\s*.+)?$/i
            );
            if (dateLocMatch) {
              ensureSpace(40);
              const dateLocText = sanitizeForPdf(dateLocMatch[0]);
              page.drawText(dateLocText, {
                x: margin + 5,
                y,
                size: 9,
                font: fontRegular,
                color: COLORS.textMuted,
              });
              y -= 12;
            }
          }
        }

        y -= 4; // spacing between title block and content

        // Entry rewritten content (bullets/paragraphs)
        // HOTFIX-4C: Strip unresolved placeholder tokens before export
        const cleanedEntryRewritten = stripPlaceholders(entry.rewritten);
        const paragraphs = cleanedEntryRewritten.split("\n").filter(Boolean);
        for (const para of paragraphs) {
          const lines = wrapText(sanitizeForPdf(para), fontRegular, 10, contentWidth - 15);
          for (const line of lines) {
            ensureSpace(50);
            page.drawText(line, {
              x: margin + 10,
              y,
              size: 10,
              font: fontRegular,
              color: COLORS.text,
            });
            y -= 13;
          }
          y -= 2;
        }
        y -= 14; // HOTFIX-3: clearer visual separation between entries
      }
    } else {
      // ── Section-level rendering ──
      // HOTFIX-4C: Strip unresolved placeholder tokens before export
      const cleanedSectionRewritten = stripPlaceholders(rewrite.rewritten);
      const paragraphs = cleanedSectionRewritten.split("\n").filter(Boolean);
      for (const para of paragraphs) {
        const lines = wrapText(sanitizeForPdf(para), fontRegular, 10, contentWidth);
        for (const line of lines) {
          ensureSpace(50);
          page.drawText(line, {
            x: margin,
            y,
            size: 10,
            font: fontRegular,
            color: COLORS.text,
          });
          y -= 14;
        }
        y -= 4;
      }
    }

    y -= 15; // spacing between sections
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
    color: COLORS.textMuted,
  });

  return doc.save();
}
