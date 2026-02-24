import type { ExportModuleId, ExportFormat, ProfileResult } from "@/lib/types";
import { generateResultsSummaryPdf } from "./pdf/results-summary";
import { generateUpdatedCvPdf } from "./pdf/updated-cv";
import { generateFullAuditJson } from "./json/full-audit";
import { generateLinkedinUpdatesJson } from "./json/linkedin-updates";
import { generateCoverLetterJson } from "./json/cover-letter";

interface GenerateResult {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}

/**
 * Dispatch to the correct generator based on export type and format.
 */
export async function generateExport(
  exportType: ExportModuleId,
  format: ExportFormat,
  language: string,
  results: ProfileResult
): Promise<GenerateResult> {
  switch (exportType) {
    case "results-summary": {
      if (format !== "pdf") throw new Error("Results Summary only supports PDF format");
      const bytes = await generateResultsSummaryPdf(results, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "updated-cv": {
      if (format !== "pdf") throw new Error("Updated CV only supports PDF format");
      const bytes = await generateUpdatedCvPdf(results, language);
      return { bytes, contentType: "application/pdf", ext: "pdf" };
    }

    case "full-audit": {
      if (format !== "json") throw new Error("Full Audit only supports JSON format");
      const bytes = generateFullAuditJson(results, language);
      return { bytes, contentType: "application/json", ext: "json" };
    }

    case "linkedin-updates": {
      if (format !== "json") throw new Error("LinkedIn Updates only supports JSON format");
      const bytes = generateLinkedinUpdatesJson(results, language);
      return { bytes, contentType: "application/json", ext: "json" };
    }

    case "cover-letter": {
      if (format !== "json") throw new Error("Cover Letter only supports JSON format");
      const bytes = generateCoverLetterJson(results, language);
      return { bytes, contentType: "application/json", ext: "json" };
    }

    default:
      throw new Error(`Unknown export type: ${exportType}`);
  }
}
