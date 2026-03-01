import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSignedUrl } from "@/lib/db/storage";
import type { ProfileResult } from "@/lib/types";

/** HOTFIX-9d: Map exportType → human-friendly label for filenames */
const EXPORT_TYPE_LABELS: Record<string, string> = {
  "results-summary": "ResultsSummary",
  "updated-cv": "UpdatedCV",
  "full-audit": "FullAudit",
  "linkedin-updates": "LinkedInUpdates",
  "cover-letter": "CoverLetter",
};

/**
 * HOTFIX-9d: Extract candidate name from profile results for file naming.
 * Looks at contact-info rewrite first line (which is the candidate name).
 */
function extractCandidateName(results: unknown): string {
  try {
    const r = results as ProfileResult;
    // Try CV contact-info first, then LinkedIn
    const contactRewrite =
      r.cvRewrites?.find((rw) => rw.sectionId === "contact-info") ??
      r.linkedinRewrites?.find((rw) => rw.sectionId === "contact-info");
    if (contactRewrite?.rewritten) {
      const firstLine = contactRewrite.rewritten.split("\n").filter(Boolean)[0]?.trim();
      if (firstLine && firstLine.length >= 2 && firstLine.length <= 60) {
        // Convert "Isaac Gutierrez Bolaños" → "IsaacGutierrez" (PascalCase, ASCII-safe)
        return firstLine
          .split(/\s+/)
          .slice(0, 2)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join("")
          .replace(/[^a-zA-Z0-9]/g, "");
      }
    }
  } catch {
    // Extraction is best-effort
  }
  return "Export";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const exportRecord = await prisma.export.findUnique({
      where: { id },
    });

    if (!exportRecord) {
      return NextResponse.json(
        { error: "Export not found" },
        { status: 404 }
      );
    }

    // Check if download requested
    const url = new URL(request.url);
    const isDownload = url.searchParams.get("download") === "true";
    // HOTFIX-9d: Support ?inline=true for "open in new tab" preview
    const isInline = url.searchParams.get("inline") === "true";

    if (isDownload || isInline) {
      if (exportRecord.status !== "ready" || !exportRecord.fileUrl) {
        return NextResponse.json(
          { error: "Export not ready for download" },
          { status: 400 }
        );
      }

      // HOTFIX-9b: Proxy file bytes through API instead of 302 redirect
      // This avoids CORS issues when client-side fetch follows cross-origin redirects
      const signedUrl = await getSignedUrl(exportRecord.fileUrl);
      const fileRes = await fetch(signedUrl);
      if (!fileRes.ok) {
        return NextResponse.json(
          { error: "Failed to fetch export file" },
          { status: 502 }
        );
      }

      const fileBytes = await fileRes.arrayBuffer();
      const contentType = fileRes.headers.get("content-type") ?? "application/octet-stream";
      const ext = exportRecord.fileUrl.split(".").pop() ?? "pdf";

      // HOTFIX-9d: Build UserName_ExportType filename
      let candidateName = "Export";
      try {
        const audit = await prisma.audit.findUnique({
          where: { id: exportRecord.auditId },
          select: { results: true },
        });
        if (audit?.results) {
          candidateName = extractCandidateName(audit.results);
        }
      } catch {
        // Best-effort name extraction
      }
      const typeLabel = EXPORT_TYPE_LABELS[exportRecord.exportType] ?? exportRecord.exportType;
      const filename = `${candidateName}_${typeLabel}.${ext}`;

      // HOTFIX-9d: inline disposition for new-tab preview, attachment for downloads
      const disposition = isInline
        ? `inline; filename="${filename}"`
        : `attachment; filename="${filename}"`;

      return new NextResponse(fileBytes, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": disposition,
          "Content-Length": String(fileBytes.byteLength),
        },
      });
    }

    // Return status info
    return NextResponse.json({
      exportId: exportRecord.id,
      status: exportRecord.status,
      exportType: exportRecord.exportType,
      format: exportRecord.format,
      language: exportRecord.language,
      fileUrl: exportRecord.fileUrl,
      error: exportRecord.errorMessage,
      createdAt: exportRecord.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("GET /api/exports/[id] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
