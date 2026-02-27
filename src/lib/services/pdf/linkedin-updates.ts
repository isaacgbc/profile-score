import type { ProfileResult } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import { createBasePdf, addPage, wrapText, sanitizeForPdf, COLORS } from "./shared";

import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

/**
 * Generate a LinkedIn Section Updates PDF.
 *
 * For each LinkedIn rewrite (non-locked), shows:
 * - Section heading
 * - Original text
 * - Optimized/rewritten text
 * - Improvements summary
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

  // ── Title ──
  const title =
    language === "es"
      ? "Actualizaciones de Secciones LinkedIn"
      : "LinkedIn Section Updates";
  page.drawText(sanitizeForPdf(title), {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: COLORS.primary,
  });
  y -= 15;

  // Subtitle / date
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

  // ── Labels ──
  const lOriginal = language === "es" ? "Original:" : "Original:";
  const lOptimized = language === "es" ? "Optimizado:" : "Optimized:";
  const lImprovements =
    language === "es" ? "Mejoras realizadas:" : "Improvements made:";

  // ── Sections ──
  const rewrites = results.linkedinRewrites.filter((r) => !r.locked);

  if (rewrites.length === 0) {
    const noContent =
      language === "es"
        ? "No hay actualizaciones de secciones disponibles."
        : "No section updates available.";
    page.drawText(sanitizeForPdf(noContent), {
      x: margin,
      y,
      size: 11,
      font: fontRegular,
      color: COLORS.textMuted,
    });
  }

  for (const rewrite of rewrites) {
    // Page break check — need at least ~200pt for a section block
    if (y < 200) {
      page = addPage(doc);
      y = page.getHeight() - margin;
    }

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

    // Divider
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 0.5,
      color: COLORS.border,
    });
    y -= 18;

    // ── Original ──
    page.drawText(sanitizeForPdf(lOriginal), {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: COLORS.textMuted,
    });
    y -= 14;

    const originalParagraphs = (rewrite.original || "").split("\n").filter(Boolean);
    for (const para of originalParagraphs) {
      const lines = wrapText(sanitizeForPdf(para), fontRegular, 9, contentWidth - 10);
      for (const line of lines) {
        if (y < 50) {
          page = addPage(doc);
          y = page.getHeight() - margin;
        }
        page.drawText(line, {
          x: margin + 10,
          y,
          size: 9,
          font: fontRegular,
          color: COLORS.textMuted,
        });
        y -= 12;
      }
      y -= 3;
    }
    y -= 8;

    // ── Optimized ──
    if (y < 80) {
      page = addPage(doc);
      y = page.getHeight() - margin;
    }

    page.drawText(sanitizeForPdf(lOptimized), {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: COLORS.success,
    });
    y -= 14;

    const rewrittenParagraphs = (rewrite.rewritten || "").split("\n").filter(Boolean);
    for (const para of rewrittenParagraphs) {
      const lines = wrapText(sanitizeForPdf(para), fontRegular, 10, contentWidth - 10);
      for (const line of lines) {
        if (y < 50) {
          page = addPage(doc);
          y = page.getHeight() - margin;
        }
        page.drawText(line, {
          x: margin + 10,
          y,
          size: 10,
          font: fontRegular,
          color: COLORS.text,
        });
        y -= 14;
      }
      y -= 3;
    }
    y -= 8;

    // ── Improvements ──
    if (rewrite.improvements && rewrite.improvements.trim()) {
      if (y < 80) {
        page = addPage(doc);
        y = page.getHeight() - margin;
      }

      page.drawText(sanitizeForPdf(lImprovements), {
        x: margin,
        y,
        size: 10,
        font: fontBold,
        color: COLORS.text,
      });
      y -= 14;

      const improvementLines = wrapText(
        sanitizeForPdf(rewrite.improvements),
        fontRegular,
        9,
        contentWidth - 10
      );
      for (const line of improvementLines) {
        if (y < 50) {
          page = addPage(doc);
          y = page.getHeight() - margin;
        }
        page.drawText(line, {
          x: margin + 10,
          y,
          size: 9,
          font: fontRegular,
          color: COLORS.textMuted,
        });
        y -= 12;
      }
    }

    y -= 22; // spacing between sections
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
