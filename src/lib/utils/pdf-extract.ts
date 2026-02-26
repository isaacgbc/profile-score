/**
 * PDF text extraction utility using pdfjs-dist with local bundled worker.
 * Extracts raw text from PDF files client-side. The extracted text is then
 * structured by the existing Claude LLM pipeline (parseLinkedinSections / parseCvSections).
 *
 * No CDN dependencies — worker is loaded from node_modules.
 * Uses dynamic import to avoid SSR issues (DOMMatrix not available in Node.js).
 */

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  error?: "insufficient_text" | "parse_error";
}

/** Lazily loads pdfjs-dist and configures the local worker. */
async function getPdfjsLib() {
  const pdfjsLib = await import("pdfjs-dist");
  // Local bundled worker — no CDN dependency
  if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }
  return pdfjsLib;
}

/**
 * Build line-structured text from pdfjs-dist text items.
 *
 * pdfjs-dist returns an array of text items, each with:
 *   - str: the text content
 *   - hasEOL: whether this item is followed by a line break
 *   - transform[5]: the Y coordinate (decreases as you go down the page)
 *
 * The old approach joined all items with spaces, producing one giant line
 * per page and destroying section header detection (regex needs headers
 * at the START of a line). This version preserves line structure by:
 *   1. Using `hasEOL` flags from pdfjs-dist
 *   2. Detecting Y-position jumps between consecutive items
 *   3. Inserting newlines at detected line breaks
 */
function buildLinesFromItems(
  items: Array<{ str?: string; hasEOL?: boolean; transform?: number[] }>
): string {
  if (items.length === 0) return "";

  const parts: string[] = [];
  let prevY: number | null = null;

  for (const item of items) {
    const str = item.str ?? "";
    if (str === "") {
      // Empty string with hasEOL → blank line
      if (item.hasEOL) parts.push("\n");
      continue;
    }

    const y = item.transform?.[5] ?? null;

    // Detect line break: significant Y-position change between items
    if (prevY !== null && y !== null) {
      const yDelta = Math.abs(prevY - y);
      // Threshold: >2px Y change indicates a new line (typical line height ≥10px)
      if (yDelta > 2) {
        parts.push("\n");
      }
    }

    parts.push(str);

    // pdfjs-dist's hasEOL flag indicates end-of-line
    if (item.hasEOL) {
      parts.push("\n");
      prevY = null; // reset Y tracking after explicit EOL
    } else {
      prevY = y;
    }
  }

  return parts.join("");
}

/**
 * Extract text content from a PDF file.
 * Returns raw text that can be passed to parseLinkedinSections() or parseCvSections().
 *
 * @param file - A File object from a file input or drag-and-drop
 * @returns Extracted text, page count, and optional error code
 */
export async function extractTextFromPdf(
  file: File
): Promise<PdfExtractionResult> {
  try {
    const pdfjsLib = await getPdfjsLib();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = buildLinesFromItems(
        content.items as Array<{
          str?: string;
          hasEOL?: boolean;
          transform?: number[];
        }>
      );
      pages.push(pageText.trim());
    }

    const fullText = pages.filter(Boolean).join("\n\n").trim();

    // If very little text was extracted, it's likely a scanned image PDF
    if (fullText.length < 20) {
      return {
        text: "",
        pageCount: pdf.numPages,
        error: "insufficient_text",
      };
    }

    return { text: fullText, pageCount: pdf.numPages };
  } catch {
    return {
      text: "",
      pageCount: 0,
      error: "parse_error",
    };
  }
}
