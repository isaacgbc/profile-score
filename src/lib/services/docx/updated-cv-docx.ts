import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  TabStopPosition,
  TabStopType,
  convertInchesToTwip,
} from "docx";
import type { ProfileResult, RewritePreview } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import { sanitizeTemplateOutput } from "@/lib/utils/placeholder-detect";

import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

// Ordered CV section IDs (same as PDF template)
const CV_SECTION_ORDER = [
  "contact-info",
  "professional-summary",
  "work-experience",
  "education-section",
  "skills-section",
  "certifications",
];

/**
 * Parse entry title for "Position at Company" pattern.
 */
function parseEntryTitle(title: string): { company: string; position: string } | null {
  const atMatch = title.match(/^(.+?)\s+(?:at|@|en)\s+(.+)$/i);
  if (atMatch) return { position: atMatch[1], company: atMatch[2] };
  return null;
}

/**
 * Strip LLM-generated section title from rewritten text.
 */
function stripLeadingSectionTitle(text: string, sectionLabel: string): string {
  const lines = text.split("\n");
  if (lines.length === 0) return text;
  const firstLine = lines[0].trim().replace(/[:#\-*]+$/, "").trim();
  const normalizedLabel = sectionLabel.toLowerCase().replace(/[^a-z0-9\s]/gi, "").trim();
  const normalizedFirst = firstLine.toLowerCase().replace(/[^a-z0-9\s]/gi, "").trim();
  if (normalizedFirst === normalizedLabel) {
    return lines.slice(1).join("\n").trimStart();
  }
  return text;
}

/**
 * HOTFIX-4: Generate an Updated CV DOCX (editable Word document).
 *
 * Mirrors the PDF template structure:
 * - Centered name (24pt bold) + centered contact line
 * - Section headings: uppercase, bold, bottom border
 * - Experience/Education entries: bold title + bullet points
 * - Skills as inline text
 */
export async function generateUpdatedCvDocx(
  results: ProfileResult,
  language: string
): Promise<Uint8Array> {
  const labels = i18nMap[language] ?? i18nMap.en;

  // Order rewrites
  const orderedRewrites = CV_SECTION_ORDER.map((id) =>
    results.cvRewrites.find((r) => r.sectionId === id)
  ).filter(Boolean) as RewritePreview[];

  const orderedIds = new Set(CV_SECTION_ORDER);
  const extraRewrites = results.cvRewrites.filter(
    (r) => !orderedIds.has(r.sectionId)
  );
  const allRewrites = [...orderedRewrites, ...extraRewrites];

  const paragraphs: Paragraph[] = [];

  // ── Header: Name + Contact Info ──
  const contactRewrite = allRewrites.find((r) => r.sectionId === "contact-info");
  if (contactRewrite) {
    // HOTFIX-9: Apply sanitizeTemplateOutput to DOCX contact lines
    const cleanedContact = sanitizeTemplateOutput(contactRewrite.rewritten);
    const rawContactLines = cleanedContact.split("\n").filter(Boolean);

    // HOTFIX-9b: Filter non-contact lines from header (objective, headline, etc.)
    const HEADER_EXCLUDE_RE = /^(objective|professional\s*(goal|growth|summary|profile)|career\s*(objective|goal|summary)|seeking\s|driven\s|passionate\s|results.driven|goal.oriented|looking\s*(for|to))/i;
    const SEPARATOR_ONLY_RE = /^\s*[|,;\-–—]+\s*$/;
    const CONTACT_PATTERN_RE = /(@|phone|\+?\d[\d\s\-().]{5,}|linkedin\.com|github\.com|\.com\b|[A-Z][a-z]+,\s*[A-Z]{2})/i;
    const contactLines = rawContactLines.filter((line, idx) => {
      const trimmed = line.trim();
      if (HEADER_EXCLUDE_RE.test(trimmed)) return false;
      if (SEPARATOR_ONLY_RE.test(trimmed)) return false;
      if (/^objective\s*[|:]/i.test(trimmed)) return false;
      if (idx === 0) return true;
      if (trimmed.length > 80 && !CONTACT_PATTERN_RE.test(trimmed)) return false;
      return true;
    });

    // Name (centered, 24pt bold)
    if (contactLines.length > 0) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: contactLines[0].trim(),
              bold: true,
              size: 48, // 24pt (half-points)
              font: "Times New Roman",
            }),
          ],
        })
      );
    }

    // Contact line (centered, pipe-separated)
    if (contactLines.length > 1) {
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: contactLines.slice(1).join(" | "),
              size: 20, // 10pt
              font: "Times New Roman",
            }),
          ],
        })
      );
    }
  }

  // ── Sections ──
  for (const rewrite of allRewrites) {
    if (rewrite.sectionId === "contact-info") continue;

    const label = getSectionLabel(rewrite.sectionId, labels);

    // Section heading: UPPERCASE, bold, with bottom border
    paragraphs.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 1,
            color: "000000",
          },
        },
        children: [
          new TextRun({
            text: label.toUpperCase(),
            bold: true,
            size: 20, // 10pt
            font: "Times New Roman",
          }),
        ],
      })
    );

    // HOTFIX-9: Strip placeholders + LLM-duplicated section title
    const cleanedRewritten = sanitizeTemplateOutput(
      stripLeadingSectionTitle(rewrite.rewritten, label)
    );

    // ── Entry-level rendering (work-experience, education-section) ──
    if (rewrite.entries && rewrite.entries.length > 0) {
      for (const entry of rewrite.entries) {
        const parsed = parseEntryTitle(entry.entryTitle);

        if (parsed) {
          // Company (bold)
          paragraphs.push(
            new Paragraph({
              spacing: { before: 120, after: 40 },
              children: [
                new TextRun({
                  text: parsed.company,
                  bold: true,
                  size: 20,
                  font: "Times New Roman",
                }),
              ],
            })
          );

          // Position (italic)
          paragraphs.push(
            new Paragraph({
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: parsed.position,
                  italics: true,
                  size: 20,
                  font: "Times New Roman",
                }),
              ],
            })
          );
        } else {
          // Fallback: single bold title
          paragraphs.push(
            new Paragraph({
              spacing: { before: 120, after: 40 },
              children: [
                new TextRun({
                  text: entry.entryTitle,
                  bold: true,
                  size: 20,
                  font: "Times New Roman",
                }),
              ],
            })
          );
        }

        // HOTFIX-9: Entry content — sanitize placeholders + strip duplicated title
        const cleanedEntry = sanitizeTemplateOutput(
          stripLeadingSectionTitle(entry.rewritten, entry.entryTitle)
        );
        const lines = cleanedEntry.split("\n").filter(Boolean);

        for (const rawLine of lines) {
          const isBullet =
            rawLine.trimStart().startsWith("-") || rawLine.trimStart().startsWith("*");
          const cleanLine = isBullet
            ? rawLine.trimStart().replace(/^[-*]\s*/, "")
            : rawLine;

          if (isBullet) {
            paragraphs.push(
              new Paragraph({
                indent: { left: convertInchesToTwip(0.25) },
                spacing: { after: 20 },
                bullet: { level: 0 },
                children: [
                  new TextRun({
                    text: cleanLine.trim(),
                    size: 20,
                    font: "Times New Roman",
                  }),
                ],
              })
            );
          } else {
            paragraphs.push(
              new Paragraph({
                indent: { left: convertInchesToTwip(0.25) },
                spacing: { after: 20 },
                children: [
                  new TextRun({
                    text: cleanLine.trim(),
                    size: 20,
                    font: "Times New Roman",
                  }),
                ],
              })
            );
          }
        }
      }
    } else {
      // ── Section-level content ──
      const textContent = cleanedRewritten;

      if (rewrite.sectionId === "skills-section") {
        // Skills: bold prefix + inline text
        const skillsLabel = language === "es" ? "Habilidades: " : "Skills: ";
        paragraphs.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [
              new TextRun({
                text: skillsLabel,
                bold: true,
                size: 20,
                font: "Times New Roman",
              }),
              new TextRun({
                text: textContent.replace(/\n/g, ", ").trim(),
                size: 20,
                font: "Times New Roman",
              }),
            ],
          })
        );
      } else {
        // General sections: paragraphs
        const sectionParagraphs = textContent.split("\n").filter(Boolean);
        for (const para of sectionParagraphs) {
          paragraphs.push(
            new Paragraph({
              spacing: { after: 60 },
              children: [
                new TextRun({
                  text: para.trim(),
                  size: 20,
                  font: "Times New Roman",
                }),
              ],
            })
          );
        }
      }
    }
  }

  // ── Footer ──
  const footerText =
    language === "es"
      ? "Generado por Profile Score"
      : "Generated by Profile Score";

  paragraphs.push(
    new Paragraph({
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: footerText,
          size: 16, // 8pt
          font: "Times New Roman",
          color: "888888",
        }),
      ],
    })
  );

  // ── Build document ──
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
