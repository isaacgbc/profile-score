/**
 * Client-side DOCX text extraction using mammoth.js.
 * Returns extracted plain text or a descriptive error.
 *
 * Uses dynamic import to avoid SSR issues (mammoth needs browser APIs).
 */

export interface DocxExtractionResult {
  text: string;
  wordCount: number;
  success: boolean;
  /** i18n key under input.guards.* when extraction fails */
  error?: string;
}

/**
 * Extract plain text from a DOCX file.
 *
 * @param file - A File object from a file input or drag-and-drop
 * @returns Extracted text with word count, or error info
 */
export async function extractTextFromDocx(
  file: File
): Promise<DocxExtractionResult> {
  try {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value.trim();

    const wordCount = text
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    if (text.length < 50) {
      return {
        text: "",
        wordCount: 0,
        success: false,
        error: "docxTooShort",
      };
    }

    return { text, wordCount, success: true };
  } catch {
    return {
      text: "",
      wordCount: 0,
      success: false,
      error: "docxExtractionFailed",
    };
  }
}
