import type { ProfileResult, ScoreSection } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import {
  createBasePdf,
  addPage,
  wrapText,
  sanitizeForPdf,
  COLORS,
  TIER_COLORS,
  TIER_LABELS,
} from "./shared";

import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

/**
 * Generate a Profile Audit Report PDF.
 *
 * Layout:
 * - Overall score with tier
 * - LinkedIn section scores with explanations + suggestions
 * - CV section scores with explanations + suggestions
 * - Entry-level scores if present
 */
export async function generateFullAuditPdf(
  results: ProfileResult,
  language: string
): Promise<Uint8Array> {
  const { doc, fontRegular, fontBold } = await createBasePdf();
  const labels = i18nMap[language] ?? i18nMap.en;
  const tierLabels = TIER_LABELS[language] ?? TIER_LABELS.en;
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

  function drawWrappedText(
    text: string,
    x: number,
    fontSize: number,
    font: typeof fontRegular,
    color: ReturnType<typeof COLORS.text extends infer C ? () => C : never>,
    indent = 0
  ) {
    const lines = wrapText(sanitizeForPdf(text), font, fontSize, contentWidth - indent);
    for (const line of lines) {
      ensureSpace(50);
      page.drawText(line, {
        x: x + indent,
        y,
        size: fontSize,
        font,
        color,
      });
      y -= fontSize + 3;
    }
  }

  // ── Title ──
  const title =
    language === "es"
      ? "Informe de Auditoria de Perfil"
      : "Profile Audit Report";
  page.drawText(sanitizeForPdf(title), {
    x: margin,
    y,
    size: 20,
    font: fontBold,
    color: COLORS.primary,
  });
  y -= 18;

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

  // ── Overall Score ──
  const scoreText = `${results.overallScore} / ${results.maxScore}`;
  page.drawText(sanitizeForPdf(scoreText), {
    x: margin,
    y,
    size: 36,
    font: fontBold,
    color: TIER_COLORS[results.tier],
  });

  const tierText = tierLabels[results.tier];
  const scoreWidth = fontBold.widthOfTextAtSize(sanitizeForPdf(scoreText), 36);
  page.drawText(sanitizeForPdf(tierText), {
    x: margin + scoreWidth + 15,
    y: y + 8,
    size: 16,
    font: fontRegular,
    color: TIER_COLORS[results.tier],
  });
  y -= 50;

  // Overall descriptor (if present)
  if (results.overallDescriptor) {
    const descriptorLines = wrapText(
      sanitizeForPdf(results.overallDescriptor),
      fontRegular,
      10,
      contentWidth
    );
    for (const line of descriptorLines) {
      ensureSpace(50);
      page.drawText(line, {
        x: margin,
        y,
        size: 10,
        font: fontRegular,
        color: COLORS.textMuted,
      });
      y -= 14;
    }
    y -= 10;
  }

  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: COLORS.border,
  });
  y -= 25;

  // ── Section rendering helper ──
  function drawSectionGroup(
    sections: ScoreSection[],
    heading: string
  ) {
    if (sections.length === 0) return;

    ensureSpace(150);

    // Group heading
    page.drawText(sanitizeForPdf(heading), {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: COLORS.text,
    });
    y -= 24;

    for (const section of sections) {
      ensureSpace(120);

      const sectionLabel = getSectionLabel(section.id, labels);
      const sectionScore = `${section.score}/${section.maxScore}`;
      const sectionTier = tierLabels[section.tier];

      // ── Section name + score on same line ──
      page.drawText(sanitizeForPdf(sectionLabel), {
        x: margin,
        y,
        size: 11,
        font: fontBold,
        color: COLORS.text,
      });
      page.drawText(sanitizeForPdf(`${sectionScore}  ${sectionTier}`), {
        x: margin + contentWidth - 80,
        y,
        size: 11,
        font: fontRegular,
        color: TIER_COLORS[section.tier],
      });
      y -= 18;

      // ── Explanation ("Why this score") ──
      if (section.explanation) {
        const whyLabel =
          language === "es" ? "Por que esta puntuacion:" : "Why this score:";
        page.drawText(sanitizeForPdf(whyLabel), {
          x: margin + 10,
          y,
          size: 9,
          font: fontBold,
          color: COLORS.textMuted,
        });
        y -= 12;

        const explanationLines = wrapText(
          sanitizeForPdf(section.explanation),
          fontRegular,
          9,
          contentWidth - 20
        );
        for (const line of explanationLines) {
          ensureSpace(50);
          page.drawText(line, {
            x: margin + 15,
            y,
            size: 9,
            font: fontRegular,
            color: COLORS.textMuted,
          });
          y -= 12;
        }
        y -= 4;
      }

      // ── Improvement suggestions ──
      if (section.improvementSuggestions.length > 0) {
        ensureSpace(60);
        const sugLabel =
          language === "es" ? "Sugerencias:" : "Suggestions:";
        page.drawText(sanitizeForPdf(sugLabel), {
          x: margin + 10,
          y,
          size: 9,
          font: fontBold,
          color: COLORS.text,
        });
        y -= 12;

        for (const suggestion of section.improvementSuggestions) {
          const lines = wrapText(
            sanitizeForPdf(`- ${suggestion}`),
            fontRegular,
            9,
            contentWidth - 25
          );
          for (const line of lines) {
            ensureSpace(50);
            page.drawText(line, {
              x: margin + 15,
              y,
              size: 9,
              font: fontRegular,
              color: COLORS.textMuted,
            });
            y -= 12;
          }
        }
        y -= 4;
      }

      // ── Entry-level scores (if present) ──
      if (section.entryScores && section.entryScores.length > 0) {
        ensureSpace(60);
        const entryLabel =
          language === "es" ? "Puntuaciones por entrada:" : "Entry-level scores:";
        page.drawText(sanitizeForPdf(entryLabel), {
          x: margin + 10,
          y,
          size: 9,
          font: fontBold,
          color: COLORS.text,
        });
        y -= 12;

        for (const entry of section.entryScores) {
          ensureSpace(50);

          // Entry title + score
          const entryLine = `${entry.entryTitle}: ${entry.score}/10`;
          page.drawText(sanitizeForPdf(entryLine), {
            x: margin + 15,
            y,
            size: 9,
            font: fontBold,
            color: COLORS.textMuted,
          });
          y -= 12;

          // Brief explanation
          if (entry.whyThisScore) {
            const whyLines = wrapText(
              sanitizeForPdf(entry.whyThisScore),
              fontRegular,
              8,
              contentWidth - 30
            );
            for (const line of whyLines.slice(0, 3)) {
              ensureSpace(50);
              page.drawText(line, {
                x: margin + 20,
                y,
                size: 8,
                font: fontRegular,
                color: COLORS.textMuted,
              });
              y -= 11;
            }
          }
          y -= 2;
        }
        y -= 4;
      }

      y -= 12; // spacing between sections
    }
    y -= 8;
  }

  // ── LinkedIn Sections ──
  const linkedinHeading =
    language === "es" ? "Secciones de LinkedIn" : "LinkedIn Sections";
  drawSectionGroup(results.linkedinSections, linkedinHeading);

  // ── CV Sections ──
  const cvHeading =
    language === "es" ? "Secciones del CV" : "CV Sections";
  drawSectionGroup(results.cvSections, cvHeading);

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
