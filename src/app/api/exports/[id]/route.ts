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
      const filename = `${exportRecord.exportType}.${ext}`;

      return new NextResponse(fileBytes, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
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
