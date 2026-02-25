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
      // Join text items with spaces, preserving line structure
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
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
