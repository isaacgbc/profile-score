import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSignedUrl } from "@/lib/db/storage";

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

    if (isDownload) {
      if (exportRecord.status !== "ready" || !exportRecord.fileUrl) {
        return NextResponse.json(
          { error: "Export not ready for download" },
          { status: 400 }
        );
      }

      // Generate signed URL and redirect
      const signedUrl = await getSignedUrl(exportRecord.fileUrl);
      return NextResponse.redirect(signedUrl, 302);
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
