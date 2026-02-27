import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { ScoreTier } from "@/lib/types";

export const COLORS = {
  primary: rgb(0.13, 0.35, 0.85),
  accent: rgb(0.25, 0.47, 0.95),
  success: rgb(0.13, 0.67, 0.42),
  warning: rgb(0.85, 0.55, 0.0),
  error: rgb(0.82, 0.18, 0.18),
  text: rgb(0.12, 0.12, 0.14),
  textMuted: rgb(0.45, 0.47, 0.51),
  border: rgb(0.88, 0.89, 0.91),
  bg: rgb(0.97, 0.97, 0.98),
  white: rgb(1, 1, 1),
};

export const TIER_COLORS: Record<ScoreTier, ReturnType<typeof rgb>> = {
  poor: COLORS.error,
  fair: COLORS.warning,
  good: COLORS.success,
  excellent: COLORS.primary,
};

export const TIER_LABELS: Record<string, Record<ScoreTier, string>> = {
  en: { poor: "Poor", fair: "Fair", good: "Good", excellent: "Excellent" },
  es: { poor: "Pobre", fair: "Regular", good: "Bueno", excellent: "Excelente" },
};

export async function createBasePdf() {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { doc, fontRegular, fontBold };
}

/** Create a CV-specific PDF with Times New Roman fonts (matching professional CV templates). */
export async function createCvBasePdf() {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  return { doc, fontRegular, fontBold, fontItalic };
}

export function addPage(doc: PDFDocument) {
  return doc.addPage([595.28, 841.89]); // A4
}

/**
 * Sanitize text for pdf-lib StandardFonts (WinAnsi encoding).
 * Strips emojis, dingbats, variation selectors, and any character
 * outside basic Latin + Latin-1 Supplement. Converts smart quotes,
 * bullets, and dashes to WinAnsi-safe equivalents.
 */
export function sanitizeForPdf(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")      // emojis block
    .replace(/[\u{2600}-\u{27BF}]/gu, "")         // misc symbols + dingbats
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")         // variation selectors
    .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, "") // zero-width chars
    .replace(/\u2022/g, "-")                        // bullet → hyphen
    .replace(/\u2026/g, "...")                      // ellipsis → three dots
    .replace(/[\u2018\u2019]/g, "'")                // smart single quotes → straight
    .replace(/[\u201C\u201D]/g, '"')                // smart double quotes → straight
    .replace(/[\u2013\u2014]/g, "-")                // en/em dash → hyphen
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");        // strip anything else non-WinAnsi
}

/** Wrap text to fit within a max width. Returns array of lines. */
export function wrapText(
  text: string,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
