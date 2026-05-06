import type { ProfileResult, Locale } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import { rgb } from "pdf-lib";
import {
  createBasePdf,
  addPage,
  wrapText,
  sanitizeForPdf,
  COLORS,
  TIER_COLORS,
  TIER_LABELS,
} from "./shared";
import { getActivePrompt, interpolatePrompt } from "@/lib/services/prompt-resolver";

import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

const BRAND_ACCENT = rgb(0.13, 0.35, 0.85);
const ROW_ALT = rgb(0.97, 0.97, 0.99);

/**
 * PHASE 4.2: Generate a Results Summary PDF — Clean Scorecard
 *
 * - ProfileScore branding at top
 * - Overall score badge (circle + number + tier)
 * - Per-section score table with alternating row colors
 * - Top 3 improvement suggestions from highest-impact sections
 * - Footer CTA: "Get detailed rewrites → profilescore.io"
 */
export async function generateResultsSummaryPdf(
  results: ProfileResult,
  language: string
): Promise<Uint8Array> {
  const { doc, fontRegular, fontBold } = await createBasePdf();
  const labels = i18nMap[language] ?? i18nMap.en;
  const tierLabels = TIER_LABELS[language] ?? TIER_LABELS.en;
  const margin = 50;
  const pageWidth = 612;
  const contentWidth = pageWidth - margin * 2;

  let page = addPage(doc);
  let y = page.getHeight() - margin;

  function ensureSpace(needed: number) {
    if (y < needed) { page = addPage(doc); y = page.getHeight() - margin; }
  }

  // ── Branding ──
  page.drawText("ProfileScore", { x: margin, y, size: 12, font: fontBold, color: BRAND_ACCENT });
  const subtitle = language === "es" ? "Resumen de Resultados" : "Results Summary";
  const subW = fontRegular.widthOfTextAtSize(sanitizeForPdf(subtitle), 12);
  page.drawText(sanitizeForPdf(subtitle), { x: pageWidth - margin - subW, y, size: 12, font: fontRegular, color: COLORS.textMuted });
  y -= 18;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 2, color: BRAND_ACCENT });
  y -= 30;

  // ── Header prompt text ──
  const headerPrompt = await getActivePrompt("export.results-summary.header", language as Locale);
  const headerText = headerPrompt
    ? interpolatePrompt(headerPrompt, { export_date: new Date().toLocaleDateString(language === "es" ? "es-ES" : "en-US") })
    : null;
  const headerLines = headerText?.split("\n").filter(Boolean) ?? [];
  for (let i = 1; i < Math.min(headerLines.length, 4); i++) {
    for (const sl of wrapText(sanitizeForPdf(headerLines[i]), fontRegular, 9, contentWidth)) {
      page.drawText(sl, { x: margin, y, size: 9, font: fontRegular, color: COLORS.textMuted });
      y -= 13;
    }
  }
  y -= 15;

  // ── Score Badge ──
  ensureSpace(120);
  const scoreStr = String(results.overallScore);
  const tierText = tierLabels[results.tier];
  const badgeR = 35;
  const badgeCX = margin + badgeR + 10;
  const badgeCY = y - badgeR + 5;

  page.drawCircle({ x: badgeCX, y: badgeCY, size: badgeR, color: TIER_COLORS[results.tier], opacity: 0.1 });
  page.drawCircle({ x: badgeCX, y: badgeCY, size: badgeR, borderColor: TIER_COLORS[results.tier], borderWidth: 2 });

  const scoreW = fontBold.widthOfTextAtSize(sanitizeForPdf(scoreStr), 28);
  page.drawText(sanitizeForPdf(scoreStr), { x: badgeCX - scoreW / 2, y: badgeCY - 5, size: 28, font: fontBold, color: TIER_COLORS[results.tier] });

  const infoX = margin + badgeR * 2 + 30;
  page.drawText(sanitizeForPdf(`/ ${results.maxScore}  ${tierText}`), { x: infoX, y: badgeCY + 12, size: 14, font: fontRegular, color: TIER_COLORS[results.tier] });

  if (results.overallDescriptor) {
    const descLines = wrapText(sanitizeForPdf(results.overallDescriptor), fontRegular, 9, contentWidth - badgeR * 2 - 40);
    let descY = badgeCY - 6;
    for (const line of descLines.slice(0, 3)) {
      page.drawText(line, { x: infoX, y: descY, size: 9, font: fontRegular, color: COLORS.textMuted });
      descY -= 12;
    }
  }
  y = badgeCY - badgeR - 20;

  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: COLORS.border });
  y -= 20;

  // ── Section Score Table ──
  function drawSectionTable(sections: ProfileResult["linkedinSections"], heading: string) {
    if (sections.length === 0) return;
    ensureSpace(150);
    page.drawText(sanitizeForPdf(heading), { x: margin, y, size: 13, font: fontBold, color: COLORS.text });
    y -= 20;

    const colScore = margin + contentWidth - 120;
    const colTier = margin + contentWidth - 50;
    page.drawText(language === "es" ? "Seccion" : "Section", { x: margin, y, size: 9, font: fontBold, color: COLORS.textMuted });
    page.drawText(language === "es" ? "Puntaje" : "Score", { x: colScore, y, size: 9, font: fontBold, color: COLORS.textMuted });
    page.drawText(language === "es" ? "Nivel" : "Tier", { x: colTier, y, size: 9, font: fontBold, color: COLORS.textMuted });
    y -= 14;

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (y < 80) { page = addPage(doc); y = page.getHeight() - margin; }
      if (i % 2 === 0) {
        page.drawRectangle({ x: margin - 4, y: y - 4, width: contentWidth + 8, height: 16, color: ROW_ALT });
      }
      page.drawText(sanitizeForPdf(getSectionLabel(s.id, labels)), { x: margin, y, size: 10, font: fontRegular, color: COLORS.text });
      page.drawText(sanitizeForPdf(`${s.score}/${s.maxScore}`), { x: colScore, y, size: 10, font: fontBold, color: TIER_COLORS[s.tier] });
      page.drawText(sanitizeForPdf(tierLabels[s.tier]), { x: colTier, y, size: 10, font: fontRegular, color: TIER_COLORS[s.tier] });
      y -= 18;
    }
    y -= 10;
  }

  drawSectionTable(results.linkedinSections, language === "es" ? "Secciones de LinkedIn" : "LinkedIn Sections");
  drawSectionTable(results.cvSections, language === "es" ? "Secciones del CV" : "CV Sections");

  // ── Top 3 Improvement Suggestions ──
  const allSections = [...results.linkedinSections, ...results.cvSections];
  const sorted = allSections.filter((s) => s.improvementSuggestions.length > 0).sort((a, b) => a.score - b.score);
  const topSugs: { section: string; suggestion: string }[] = [];
  for (const s of sorted) {
    if (topSugs.length >= 3) break;
    for (const sug of s.improvementSuggestions.slice(0, 1)) {
      if (topSugs.length >= 3) break;
      topSugs.push({ section: getSectionLabel(s.id, labels), suggestion: sug });
    }
  }

  if (topSugs.length > 0) {
    ensureSpace(100);
    page.drawText(sanitizeForPdf(language === "es" ? "Principales Mejoras Recomendadas" : "Top Improvement Recommendations"), {
      x: margin, y, size: 13, font: fontBold, color: COLORS.text,
    });
    y -= 20;
    for (const ts of topSugs) {
      ensureSpace(60);
      page.drawText(sanitizeForPdf(`${ts.section}:`), { x: margin, y, size: 10, font: fontBold, color: BRAND_ACCENT });
      y -= 13;
      for (const line of wrapText(sanitizeForPdf(ts.suggestion), fontRegular, 9, contentWidth - 10)) {
        page.drawText(line, { x: margin + 10, y, size: 9, font: fontRegular, color: COLORS.textMuted });
        y -= 12;
      }
      y -= 6;
    }
  }

  // ── Footer CTA ──
  ensureSpace(40);
  y -= 10;
  page.drawLine({ start: { x: margin, y: y + 8 }, end: { x: pageWidth - margin, y: y + 8 }, thickness: 0.5, color: COLORS.border });
  const cta = language === "es"
    ? "Obtener reescrituras detalladas y auditoria completa -> profilescore.io"
    : "Get detailed rewrites and full audit -> profilescore.io";
  page.drawText(sanitizeForPdf(cta), { x: margin, y: y - 5, size: 9, font: fontBold, color: BRAND_ACCENT });

  return doc.save();
}
