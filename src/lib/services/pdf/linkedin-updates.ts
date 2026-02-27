import type { ProfileResult } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import { createBasePdf, addPage, wrapText, sanitizeForPdf, COLORS } from "./shared";

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
      for (let entryIndex = 0; entryIndex < rewrite.entries.length; entryIndex++) {
        const entry = rewrite.entries[entryIndex];
        ensureSpace(80);

        // Light separator line between entries (not before first)
        if (entryIndex > 0) {
          page.drawLine({
            start: { x: margin + 10, y: y + 4 },
            end: { x: pageWidth - margin - 10, y: y + 4 },
            thickness: 0.3,
            color: COLORS.border,
          });
          y -= 6;
        }

        // Entry title (bold)
        const titleLines = wrapText(
          sanitizeForPdf(entry.entryTitle),
          fontBold,
          11,
          contentWidth
        );
        for (const line of titleLines) {
          ensureSpace(50);
          page.drawText(line, {
            x: margin + 5,
            y,
            size: 11,
            font: fontBold,
            color: COLORS.text,
          });
          y -= 16; // increased from 15 for better spacing
        }

        // Entry rewritten content (bullets/paragraphs)
        const paragraphs = entry.rewritten.split("\n").filter(Boolean);
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
        y -= 12; // increased from 8 for clearer visual blocks
      }
    } else {
      // ── Section-level rendering ──
      const paragraphs = rewrite.rewritten.split("\n").filter(Boolean);
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
