import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  TabStopType,
  convertInchesToTwip,
  LevelFormat,
} from "docx";
import type { ILevelsOptions } from "docx";
import type { ProfileResult, RewritePreview } from "@/lib/types";
import { getSectionLabel } from "@/lib/section-labels";
import { sanitizeTemplateOutput } from "@/lib/utils/placeholder-detect";
import { shortenLinkedInUrl } from "@/lib/services/pdf/shared";

import en from "@/lib/i18n/en.json";
import es from "@/lib/i18n/es.json";

const i18nMap: Record<string, Record<string, string>> = {
  en: (en as Record<string, unknown>).sectionLabels as Record<string, string>,
  es: (es as Record<string, unknown>).sectionLabels as Record<string, string>,
};

// Wonsulting-style CV section IDs for professionals (experience first)
const PROFESSIONAL_SECTION_ORDER = [
  "contact-info",
  "professional-summary",
  "work-experience",
  "leadership-experience",
  "education-section",
  "skills-section",
  "certifications",
];

// Wonsulting-style CV section IDs for students/entry-level (education first)
const STUDENT_SECTION_ORDER = [
  "contact-info",
  "education-section",
  "work-experience",
  "leadership-experience",
  "professional-summary",
  "skills-section",
  "certifications",
];

/**
 * Detect if profile is student/entry-level based on section content.
 * Heuristic: if education has recent dates (within 2 years) and work-experience
 * has fewer than 2 entries, treat as student layout.
 */
function isStudentProfile(rewrites: RewritePreview[]): boolean {
  const workExp = rewrites.find((r) => r.sectionId === "work-experience");
  const education = rewrites.find((r) => r.sectionId === "education-section");

  const workEntryCount = workExp?.entries?.length ?? 0;
  if (workEntryCount === 0) return true;
  if (workEntryCount <= 1 && education?.entries && education.entries.length > 0) {
    const eduText = education.rewritten + (education.entries?.map((e) => e.rewritten).join(" ") ?? "");
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear, currentYear - 1, currentYear + 1, currentYear + 2];
    const hasRecentEdu = recentYears.some((yr) => eduText.includes(String(yr)));
    if (hasRecentEdu) return true;
  }
  return false;
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

// ── Wonsulting bullet list numbering config ──
const WONSULTING_BULLET_LEVELS: ILevelsOptions[] = [
  {
    level: 0,
    format: LevelFormat.BULLET,
    text: "\u2022",
    alignment: AlignmentType.LEFT,
    style: {
      paragraph: {
        indent: {
          left: convertInchesToTwip(0.5),
          hanging: convertInchesToTwip(0.25),
        },
      },
    },
  },
];

// Page width in DXA for US Letter with 1 inch margins
const RIGHT_TAB_DXA = convertInchesToTwip(6.5); // 8.5 - 1 - 1

/**
 * PHASE 4.2: Generate an Updated CV DOCX — Wonsulting Style
 *
 * Layout:
 * - US Letter (8.5" x 11"), 1 inch margins
 * - Times New Roman throughout
 * - Centered name (18pt bold) + contact line (11pt)
 * - Horizontal rule after header
 * - Section headings: 10pt bold, ALL CAPS, bottom border
 * - Entries: Company + Location (bold), Position + Dates (italic) on right-tab lines
 * - Bullets: proper LevelFormat.BULLET, 18pt indent
 * - ATS-friendly: no tables, no images, no columns
 */
export async function generateUpdatedCvDocx(
  results: ProfileResult,
  language: string
): Promise<Uint8Array> {
  const labels = i18nMap[language] ?? i18nMap.en;

  // Determine section order based on profile type
  const isStudent = isStudentProfile(results.cvRewrites);
  const sectionOrder = isStudent ? STUDENT_SECTION_ORDER : PROFESSIONAL_SECTION_ORDER;

  // Order rewrites
  const orderedRewrites = sectionOrder
    .map((id) => results.cvRewrites.find((r) => r.sectionId === id))
    .filter(Boolean) as RewritePreview[];

  const orderedIds = new Set(sectionOrder);
  const extraRewrites = results.cvRewrites.filter(
    (r) => !orderedIds.has(r.sectionId)
  );
  const allRewrites = [...orderedRewrites, ...extraRewrites];

  const paragraphs: Paragraph[] = [];

  // ── Header: Name + Contact Info ──
  const contactRewrite = allRewrites.find((r) => r.sectionId === "contact-info");
  if (contactRewrite) {
    const cleanedContact = sanitizeTemplateOutput(contactRewrite.rewritten);
    const rawContactLines = cleanedContact.split("\n").filter(Boolean);

    const HEADER_EXCLUDE_RE = /^(objective|professional\s*(goal|growth|summary|profile)|career\s*(objective|goal|summary)|seeking\s|driven\s|passionate\s|results.driven|goal.oriented|looking\s*(for|to)|summary\s*[|:])/i;
    const SEPARATOR_ONLY_RE = /^\s*[|,;\-\u2013\u2014]+\s*$/;
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

    // Name: 18pt bold, centered
    const nameText =
      contactLines.length > 0 && contactLines[0].trim().length > 0
        ? contactLines[0].trim()
        : "Candidate";
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: nameText,
            bold: true,
            size: 36, // 18pt in half-points
            font: "Times New Roman",
          }),
        ],
      })
    );

    // Contact line: 11pt normal, centered — "Location | LinkedIn | Phone | Email"
    if (contactLines.length > 1) {
      const hasLinkedInUrl = contactLines.some((l) => /linkedin\.com\/in\//i.test(l));
      const dedupedLines = hasLinkedInUrl
        ? contactLines.filter((l) => !/^\s*linkedin\s*$/i.test(l.trim()))
        : contactLines;
      const contactText = shortenLinkedInUrl(dedupedLines.slice(1).join(" | "));
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: contactText,
              size: 22, // 11pt
              font: "Times New Roman",
            }),
          ],
        })
      );
    }

    // Horizontal rule: 0.5pt solid black
    paragraphs.push(
      new Paragraph({
        spacing: { after: 120 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 1,
            color: "000000",
          },
        },
        children: [],
      })
    );
  } else {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: "Candidate",
            bold: true,
            size: 36,
            font: "Times New Roman",
          }),
        ],
      })
    );
  }

  // ── Sections ──
  for (const rewrite of allRewrites) {
    if (rewrite.sectionId === "contact-info") continue;

    const label = getSectionLabel(rewrite.sectionId, labels);

    // Section heading: 10pt bold, ALL CAPS, bottom border 0.5pt
    paragraphs.push(
      new Paragraph({
        spacing: { before: 200, after: 80 },
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

    const cleanedRewritten = sanitizeTemplateOutput(
      stripLeadingSectionTitle(rewrite.rewritten, label)
    );

    // ── Entry-level rendering (work-experience, education-section) ──
    if (rewrite.entries && rewrite.entries.length > 0) {
      for (const entry of rewrite.entries) {
        const org = entry.organization ?? "";
        const titleRole = entry.title ?? "";
        const dateRange = entry.dateRange ?? "";

        if (org) {
          // Line 1: Company (bold) + Location (bold, right-aligned)
          const orgParts = parseOrgLocation(org);
          const line1Children: TextRun[] = [
            new TextRun({
              text: orgParts.name,
              bold: true,
              size: 20,
              font: "Times New Roman",
            }),
          ];
          if (orgParts.location) {
            line1Children.push(
              new TextRun({ text: "\t", size: 20, font: "Times New Roman" }),
              new TextRun({
                text: orgParts.location,
                bold: true,
                size: 20,
                font: "Times New Roman",
              })
            );
          }
          paragraphs.push(
            new Paragraph({
              spacing: { before: 100, after: 0 },
              tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_DXA }],
              children: line1Children,
            })
          );

          // Line 2: Position (italic) + Date range (italic, right-aligned)
          if (titleRole || dateRange) {
            const line2Children: TextRun[] = [];
            if (titleRole) {
              line2Children.push(
                new TextRun({
                  text: titleRole,
                  italics: true,
                  size: 20,
                  font: "Times New Roman",
                })
              );
            }
            if (dateRange) {
              line2Children.push(
                new TextRun({ text: "\t", size: 20, font: "Times New Roman" }),
                new TextRun({
                  text: dateRange,
                  italics: true,
                  size: 20,
                  font: "Times New Roman",
                })
              );
            }
            paragraphs.push(
              new Paragraph({
                spacing: { after: 40 },
                tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB_DXA }],
                children: line2Children,
              })
            );
          }
        } else {
          // Fallback: regex-based parsing for old cached results
          const parsed = parseEntryTitle(entry.entryTitle);
          if (parsed) {
            paragraphs.push(
              new Paragraph({
                spacing: { before: 100, after: 0 },
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
            paragraphs.push(
              new Paragraph({
                spacing: { before: 100, after: 40 },
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
        }

        // Entry content as bullet points
        const cleanedEntry = sanitizeTemplateOutput(
          stripLeadingSectionTitle(entry.rewritten, entry.entryTitle)
        );
        const lines = cleanedEntry.split("\n").filter(Boolean);

        for (const rawLine of lines) {
          const isBullet =
            rawLine.trimStart().startsWith("-") || rawLine.trimStart().startsWith("*");
          const cleanLine = isBullet
            ? rawLine.trimStart().replace(/^[-*]\s*/, "").trim()
            : rawLine.trim();

          if (!cleanLine) continue;

          if (isBullet) {
            paragraphs.push(
              new Paragraph({
                numbering: { reference: "wonsulting-bullets", level: 0 },
                spacing: { after: 20 },
                children: [
                  new TextRun({
                    text: cleanLine,
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
                    text: cleanLine,
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
      if (rewrite.sectionId === "skills-section") {
        const skillsLabel = language === "es" ? "Habilidades: " : "Skills: ";
        const skillsText = cleanedRewritten.replace(/\n/g, " | ").trim();
        paragraphs.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: skillsLabel,
                bold: true,
                size: 20,
                font: "Times New Roman",
              }),
              new TextRun({
                text: skillsText,
                size: 20,
                font: "Times New Roman",
              }),
            ],
          })
        );
      } else {
        const sectionParagraphs = cleanedRewritten.split("\n").filter(Boolean);
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

  // ── Build document — US Letter, 1 inch margins ──
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "wonsulting-bullets",
          levels: WONSULTING_BULLET_LEVELS,
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.5),
              height: convertInchesToTwip(11),
            },
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

/**
 * Parse entry title for "Position at Company" pattern.
 */
function parseEntryTitle(title: string): { company: string; position: string } | null {
  const atMatch = title.match(/^(.+?)\s+(?:at|@|en)\s+(.+)$/i);
  if (atMatch) return { position: atMatch[1], company: atMatch[2] };
  return null;
}

/**
 * Parse organization string for "Company — Location" or "Company, City, ST" patterns.
 */
function parseOrgLocation(org: string): { name: string; location: string | null } {
  const dashMatch = org.match(/^(.+?)\s*[-\u2013\u2014]\s*([A-Z][a-zA-Z\s]+,\s*[A-Z]{2,}.*)$/);
  if (dashMatch) return { name: dashMatch[1].trim(), location: dashMatch[2].trim() };

  const commaMatch = org.match(/^(.+?),\s*([A-Z][a-zA-Z\s]+,\s*[A-Z]{2,}.*)$/);
  if (commaMatch) return { name: commaMatch[1].trim(), location: commaMatch[2].trim() };

  return { name: org, location: null };
}
