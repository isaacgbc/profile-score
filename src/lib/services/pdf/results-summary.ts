import type { ProfileResult, Locale } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import {
  createBasePdf,
  addPage,
  wrapText,
  COLORS,
  TIER_COLORS,
  TIER_LABELS,
} from "./shared";
import { getActivePrompt, interpolatePrompt } from "@/lib/services/prompt-resolver";

// Load i18n section labels
import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

export async function generateResultsSummaryPdf(
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

  // Title — resolve from prompt registry, fallback to hardcoded
  const headerPrompt = await getActivePrompt(
    "export.results-summary.header",
    language as Locale
  );
  const headerText = headerPrompt
    ? interpolatePrompt(headerPrompt, {
        export_date: new Date().toLocaleDateString(language === "es" ? "es-ES" : "en-US"),
      })
    : null;

  // Use first line of prompt as title, rest as subtitle
  const headerLines = headerText?.split("\n").filter(Boolean) ?? [];
  const title = headerLines[0] ?? (language === "es" ? "Resumen de Resultados" : "Results Summary");
  page.drawText(title, {
    x: margin,
    y,
    size: 22,
    font: fontBold,
    color: COLORS.primary,
  });
  y -= 22;

  // Draw subtitle lines from prompt (lines 2+)
  for (let i = 1; i < Math.min(headerLines.length, 4); i++) {
    const subLines = wrapText(headerLines[i], fontRegular, 9, contentWidth);
    for (const sl of subLines) {
      page.drawText(sl, {
        x: margin,
        y,
        size: 9,
        font: fontRegular,
        color: COLORS.textMuted,
      });
      y -= 13;
    }
  }
  y -= 13;

  // Overall Score
  const scoreText = `${results.overallScore} / ${results.maxScore}`;
  page.drawText(scoreText, {
    x: margin,
    y,
    size: 36,
    font: fontBold,
    color: TIER_COLORS[results.tier],
  });

  const tierText = tierLabels[results.tier];
  const scoreWidth = fontBold.widthOfTextAtSize(scoreText, 36);
  page.drawText(tierText, {
    x: margin + scoreWidth + 15,
    y: y + 8,
    size: 16,
    font: fontRegular,
    color: TIER_COLORS[results.tier],
  });
  y -= 45;

  // Divider
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: COLORS.border,
  });
  y -= 25;

  // Sections helper
  function drawSections(
    sectionList: ProfileResult["linkedinSections"],
    heading: string
  ) {
    if (sectionList.length === 0) return;

    // Check if we need a new page
    if (y < 150) {
      page = addPage(doc);
      y = page.getHeight() - margin;
    }

    page.drawText(heading, {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: COLORS.text,
    });
    y -= 22;

    for (const section of sectionList) {
      if (y < 100) {
        page = addPage(doc);
        y = page.getHeight() - margin;
      }

      const label = getSectionLabel(section.id, labels);
      const sectionScore = `${section.score}/${section.maxScore}`;
      const sectionTier = tierLabels[section.tier];

      // Section name + score
      page.drawText(label, {
        x: margin,
        y,
        size: 11,
        font: fontBold,
        color: COLORS.text,
      });
      page.drawText(`${sectionScore}  ${sectionTier}`, {
        x: margin + contentWidth - 80,
        y,
        size: 11,
        font: fontRegular,
        color: TIER_COLORS[section.tier],
      });
      y -= 16;

      // Top 2 suggestions
      const suggestions = section.improvementSuggestions.slice(0, 2);
      for (const suggestion of suggestions) {
        const lines = wrapText(
          `- ${suggestion}`,
          fontRegular,
          9,
          contentWidth - 20
        );
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
          y -= 13;
        }
      }
      y -= 8;
    }
    y -= 10;
  }

  // LinkedIn Sections
  const linkedinHeading =
    language === "es" ? "Secciones de LinkedIn" : "LinkedIn Sections";
  drawSections(results.linkedinSections, linkedinHeading);

  // CV Sections
  const cvHeading =
    language === "es" ? "Secciones del CV" : "CV Sections";
  drawSections(results.cvSections, cvHeading);

  // Footer
  const footerText =
    language === "es"
      ? "Generado por Profile Score"
      : "Generated by Profile Score";
  page.drawText(footerText, {
    x: margin,
    y: 30,
    size: 8,
    font: fontRegular,
    color: COLORS.textMuted,
  });

  return doc.save();
}
