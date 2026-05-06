import type { ProfileResult, ScoreSection } from "@/lib/types";
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
import { sanitizeTemplateOutput } from "@/lib/utils/placeholder-detect";

import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

const BRAND_ACCENT = rgb(0.13, 0.35, 0.85);
const REWRITE_BG = rgb(0.96, 0.97, 0.99); // Light blue-gray for rewrite boxes

/**
 * PHASE 4.2: Generate a Full Audit Report PDF — Detailed Premium Report
 *
 * - ProfileScore branding at top
 * - Overall score + descriptor
 * - Per section: score + tier badge, explanation, suggestions, rewritten version in highlighted box
 * - Cover letter on its own page (if generated)
 * - Professional report styling with headers, dividers, whitespace
 */
export async function generateFullAuditPdf(
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
  y -= 18;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 2, color: BRAND_ACCENT });
  y -= 25;

  // ── Title ──
  const title = language === "es" ? "Informe Completo de Auditoria de Perfil" : "Full Profile Audit Report";
  page.drawText(sanitizeForPdf(title), { x: margin, y, size: 18, font: fontBold, color: COLORS.text });
  y -= 18;
  const dateStr = new Date().toLocaleDateString(language === "es" ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  page.drawText(sanitizeForPdf(dateStr), { x: margin, y, size: 9, font: fontRegular, color: COLORS.textMuted });
  y -= 30;

  // ── Overall Score ──
  const scoreText = `${results.overallScore} / ${results.maxScore}`;
  page.drawText(sanitizeForPdf(scoreText), { x: margin, y, size: 32, font: fontBold, color: TIER_COLORS[results.tier] });
  const scoreW = fontBold.widthOfTextAtSize(sanitizeForPdf(scoreText), 32);
  page.drawText(sanitizeForPdf(tierLabels[results.tier]), { x: margin + scoreW + 15, y: y + 8, size: 14, font: fontRegular, color: TIER_COLORS[results.tier] });
  y -= 40;

  if (results.overallDescriptor) {
    for (const line of wrapText(sanitizeForPdf(results.overallDescriptor), fontRegular, 10, contentWidth)) {
      ensureSpace(50);
      page.drawText(line, { x: margin, y, size: 10, font: fontRegular, color: COLORS.textMuted });
      y -= 14;
    }
    y -= 10;
  }

  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: COLORS.border });
  y -= 25;

  // ── Section rendering ──
  function drawSectionGroup(sections: ScoreSection[], rewrites: ProfileResult["linkedinRewrites"], heading: string) {
    if (sections.length === 0) return;
    ensureSpace(150);

    page.drawText(sanitizeForPdf(heading), { x: margin, y, size: 14, font: fontBold, color: COLORS.text });
    y -= 24;

    for (const section of sections) {
      ensureSpace(120);

      const sLabel = getSectionLabel(section.id, labels);
      const sScore = `${section.score}/${section.maxScore}`;
      const sTier = tierLabels[section.tier];

      // Section name + score badge
      page.drawText(sanitizeForPdf(sLabel), { x: margin, y, size: 11, font: fontBold, color: COLORS.text });

      // Tier badge background
      const badgeText = `${sScore}  ${sTier}`;
      const badgeW = fontRegular.widthOfTextAtSize(sanitizeForPdf(badgeText), 10) + 12;
      const badgeX = pageWidth - margin - badgeW;
      page.drawRectangle({ x: badgeX - 4, y: y - 3, width: badgeW + 8, height: 16, color: TIER_COLORS[section.tier], opacity: 0.1, borderColor: TIER_COLORS[section.tier], borderWidth: 0.5 });
      page.drawText(sanitizeForPdf(badgeText), { x: badgeX, y, size: 10, font: fontRegular, color: TIER_COLORS[section.tier] });
      y -= 20;

      // Explanation
      if (section.explanation) {
        const whyLabel = language === "es" ? "Analisis:" : "Analysis:";
        page.drawText(sanitizeForPdf(whyLabel), { x: margin + 10, y, size: 9, font: fontBold, color: COLORS.textMuted });
        y -= 12;
        for (const line of wrapText(sanitizeForPdf(section.explanation), fontRegular, 9, contentWidth - 20)) {
          ensureSpace(50);
          page.drawText(line, { x: margin + 15, y, size: 9, font: fontRegular, color: COLORS.textMuted });
          y -= 12;
        }
        y -= 4;
      }

      // Suggestions
      if (section.improvementSuggestions.length > 0) {
        ensureSpace(60);
        const sugLabel = language === "es" ? "Sugerencias:" : "Suggestions:";
        page.drawText(sanitizeForPdf(sugLabel), { x: margin + 10, y, size: 9, font: fontBold, color: COLORS.text });
        y -= 12;
        for (const sug of section.improvementSuggestions) {
          for (const line of wrapText(sanitizeForPdf(`- ${sug}`), fontRegular, 9, contentWidth - 25)) {
            ensureSpace(50);
            page.drawText(line, { x: margin + 15, y, size: 9, font: fontRegular, color: COLORS.textMuted });
            y -= 12;
          }
        }
        y -= 4;
      }

      // Entry-level scores
      if (section.entryScores && section.entryScores.length > 0) {
        ensureSpace(60);
        const entryLabel = language === "es" ? "Puntuaciones por entrada:" : "Entry scores:";
        page.drawText(sanitizeForPdf(entryLabel), { x: margin + 10, y, size: 9, font: fontBold, color: COLORS.text });
        y -= 12;
        for (const entry of section.entryScores) {
          ensureSpace(50);
          page.drawText(sanitizeForPdf(`${entry.entryTitle}: ${entry.score}/10`), { x: margin + 15, y, size: 9, font: fontBold, color: COLORS.textMuted });
          y -= 12;
          if (entry.whyThisScore) {
            for (const line of wrapText(sanitizeForPdf(entry.whyThisScore), fontRegular, 8, contentWidth - 30).slice(0, 3)) {
              ensureSpace(50);
              page.drawText(line, { x: margin + 20, y, size: 8, font: fontRegular, color: COLORS.textMuted });
              y -= 11;
            }
          }
          y -= 2;
        }
        y -= 4;
      }

      // Rewritten version in highlighted box
      const rewrite = rewrites.find((r) => r.sectionId === section.id);
      if (rewrite && !rewrite.locked) {
        ensureSpace(80);
        const rwLabel = language === "es" ? "Version Optimizada:" : "Optimized Version:";
        page.drawText(sanitizeForPdf(rwLabel), { x: margin + 10, y, size: 9, font: fontBold, color: BRAND_ACCENT });
        y -= 14;

        const cleanedRewrite = sanitizeTemplateOutput(rewrite.rewritten);
        const rwLines = wrapText(sanitizeForPdf(cleanedRewrite), fontRegular, 9, contentWidth - 30);
        const boxHeight = Math.min(rwLines.length * 12 + 10, 200);

        // Background box for rewrite
        page.drawRectangle({
          x: margin + 10,
          y: y - boxHeight + 10,
          width: contentWidth - 20,
          height: boxHeight,
          color: REWRITE_BG,
          borderColor: COLORS.border,
          borderWidth: 0.5,
        });

        for (const line of rwLines) {
          ensureSpace(50);
          page.drawText(line, { x: margin + 15, y: y - 2, size: 9, font: fontRegular, color: COLORS.text });
          y -= 12;
        }
        y -= 8;
      }

      y -= 12;
      page.drawLine({ start: { x: margin + 10, y: y + 6 }, end: { x: pageWidth - margin - 10, y: y + 6 }, thickness: 0.5, color: COLORS.border });
      y -= 8;
    }
    y -= 8;
  }

  drawSectionGroup(results.linkedinSections, results.linkedinRewrites, language === "es" ? "Secciones de LinkedIn" : "LinkedIn Sections");
  drawSectionGroup(results.cvSections, results.cvRewrites, language === "es" ? "Secciones del CV" : "CV Sections");

  // ── Cover Letter (on its own page, if generated) ──
  if (results.coverLetter?.content && results.coverLetter.content.trim().length > 0) {
    page = addPage(doc);
    y = page.getHeight() - margin;

    const clTitle = language === "es" ? "Carta de Presentacion Generada" : "Generated Cover Letter";
    page.drawText(sanitizeForPdf(clTitle), { x: margin, y, size: 16, font: fontBold, color: BRAND_ACCENT });
    y -= 25;

    for (const para of results.coverLetter.content.split("\n")) {
      if (!para.trim()) { y -= 10; continue; }
      for (const line of wrapText(sanitizeForPdf(para), fontRegular, 11, contentWidth)) {
        if (y < 60) { page = addPage(doc); y = page.getHeight() - margin; }
        page.drawText(line, { x: margin, y, size: 11, font: fontRegular, color: COLORS.text });
        y -= 16;
      }
      y -= 6;
    }
  }

  return doc.save();
}
