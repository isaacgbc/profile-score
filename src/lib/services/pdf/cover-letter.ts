import type { ProfileResult } from "@/lib/types";
import type { ExportUserInput } from "@/lib/services/export-generator";
import { createCvBasePdf, addPage, wrapText, sanitizeForPdf } from "./shared";
import { rgb } from "pdf-lib";

// Cover-letter-specific colors — plain black text, no branding
const CL_TEXT = rgb(0.0, 0.0, 0.0);
const CL_TEXT_MUTED = rgb(0.35, 0.35, 0.35);

/**
 * PHASE 4.2 — Generate a Cover Letter PDF: Clean Letter Format
 *
 * This should look like the USER's cover letter, NOT a ProfileScore document.
 * - No header/logo/branding
 * - Times New Roman 12pt (standard letter font)
 * - US Letter (8.5" × 11")
 * - Standard letter layout: date → recipient → greeting → body → closing
 * - 1" margins all around
 */
export async function generateCoverLetterPdf(
  results: ProfileResult,
  language: string,
  userInput?: ExportUserInput
): Promise<Uint8Array> {
  const { doc, fontRegular, fontBold } = await createCvBasePdf();
  const margin = 72; // 1 inch = 72 points
  const pageWidth = 612; // US Letter
  const contentWidth = pageWidth - margin * 2; // 468pt
  const fontSize = 12;
  const lineHeight = 18; // 1.5× line spacing for readability

  let page = addPage(doc);
  let y = page.getHeight() - margin; // start at top margin

  // ── Helpers ──
  function ensureSpace(needed: number) {
    if (y < needed + margin) {
      page = addPage(doc);
      y = page.getHeight() - margin;
    }
  }

  function drawLine(text: string, font = fontRegular, size = fontSize, color = CL_TEXT) {
    const lines = wrapText(sanitizeForPdf(text), font, size, contentWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, { x: margin, y, size, font, color });
      y -= lineHeight;
    }
  }

  // ── Date ──
  const dateStr = new Date().toLocaleDateString(
    language === "es" ? "es-ES" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );
  page.drawText(sanitizeForPdf(dateStr), {
    x: margin,
    y,
    size: fontSize,
    font: fontRegular,
    color: CL_TEXT,
  });
  y -= lineHeight * 2; // double space after date

  // ── Recipient / target role context (if available) ──
  if (userInput?.jobDescription) {
    const firstLine = userInput.jobDescription.split("\n")[0]?.trim().slice(0, 150);
    if (firstLine) {
      const targetLabel = language === "es" ? "Re:" : "Re:";
      drawLine(`${targetLabel} ${firstLine}`);
      y -= lineHeight; // extra space after recipient line
    }
  }

  // ── Body ──
  const content = results.coverLetter?.content ?? "";

  if (!content.trim()) {
    const noContent =
      language === "es"
        ? "No se genero una carta de presentacion para este perfil."
        : "No cover letter was generated for this profile.";
    page.drawText(sanitizeForPdf(noContent), {
      x: margin,
      y,
      size: fontSize,
      font: fontRegular,
      color: CL_TEXT_MUTED,
    });
  } else {
    const paragraphs = content.split("\n");

    for (const para of paragraphs) {
      // Empty lines create paragraph spacing
      if (!para.trim()) {
        y -= lineHeight * 0.6;
        continue;
      }

      const trimmed = para.trim();

      // Detect greeting lines (Dear..., Estimado...) — render bold
      const isGreeting = /^(Dear|Estimado|Estimada|To Whom)/i.test(trimmed);
      // Detect closing lines (Sincerely, Best regards, Atentamente, etc.)
      const isClosing = /^(Sincerely|Best regards|Kind regards|Respectfully|Atentamente|Cordialmente|Regards)/i.test(trimmed);

      if (isGreeting) {
        drawLine(trimmed, fontBold);
        y -= lineHeight * 0.3; // slight extra space after greeting
      } else if (isClosing) {
        y -= lineHeight * 0.5; // extra space before closing
        drawLine(trimmed);
      } else {
        drawLine(trimmed);
      }

      y -= lineHeight * 0.35; // paragraph spacing
    }
  }

  // No footer, no branding — this is the user's cover letter

  return doc.save();
}
