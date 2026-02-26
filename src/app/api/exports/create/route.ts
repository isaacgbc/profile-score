import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { CreateExportInput } from "@/lib/schemas/export";
import { checkExportGating } from "@/lib/services/export-gating";
import { isServerAdmin } from "@/lib/services/admin-guard";
import { exportRateLimiter } from "@/lib/services/rate-limiter";
import { generateExport } from "@/lib/services/export-generator";
import { uploadExport } from "@/lib/db/storage";
import type { ExportModuleId, ExportFormat, ProfileResult } from "@/lib/types";
import type { ExportUserInput } from "@/lib/services/export-generator";

export async function POST(request: Request) {
  try {
    // Rate limit by IP
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const rateCheck = exportRateLimiter.check(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests", retryAfter: rateCheck.retryAfter },
        {
          status: 429,
          headers: { "Retry-After": String(rateCheck.retryAfter ?? 60) },
        }
      );
    }

    const body = await request.json();
    const parsed = CreateExportInput.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { auditId, exportType, format, language, planId, userEdits } = parsed.data;

    // Determine admin status server-side
    const adminStatus = isServerAdmin(request);

    // Check gating
    const gating = checkExportGating(
      exportType as ExportModuleId,
      planId ?? null,
      adminStatus
    );
    if (!gating.allowed) {
      return NextResponse.json(
        { error: "Forbidden", reason: gating.reason },
        { status: 403 }
      );
    }

    // Resolve results from DB
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
    });
    if (!audit) {
      return NextResponse.json(
        { error: "Audit not found" },
        { status: 404 }
      );
    }

    let results = audit.results as unknown as ProfileResult;

    // ── Merge user edits from Rewrite Studio into results ──
    if (userEdits) {
      const improvementsMap = userEdits.userImprovements ?? {};
      const rewrittenMap = userEdits.userRewritten ?? {};
      const optimizedMap = userEdits.userOptimized ?? {};

      const mergeRewrites = (
        rewrites: ProfileResult["linkedinRewrites"]
      ): ProfileResult["linkedinRewrites"] =>
        rewrites.map((r) => ({
          ...r,
          improvements:
            improvementsMap[r.sectionId] !== undefined
              ? improvementsMap[r.sectionId]
              : r.improvements,
          rewritten:
            optimizedMap[r.sectionId] ??
            rewrittenMap[r.sectionId] ??
            r.rewritten,
        }));

      results = {
        ...results,
        linkedinRewrites: mergeRewrites(results.linkedinRewrites),
        cvRewrites: mergeRewrites(results.cvRewrites),
      };
    }

    // Extract sanitized userInput from audit for export context
    const storedUserInput = audit.userInput as Record<string, unknown> | null;
    const exportUserInput: ExportUserInput | undefined = storedUserInput
      ? {
          jobDescription: typeof storedUserInput.jobDescription === "string" ? storedUserInput.jobDescription : undefined,
          targetAudience: typeof storedUserInput.targetAudience === "string" ? storedUserInput.targetAudience : undefined,
          objectiveMode: storedUserInput.objectiveMode === "job" || storedUserInput.objectiveMode === "objective" ? storedUserInput.objectiveMode : undefined,
          objectiveText: typeof storedUserInput.objectiveText === "string" ? storedUserInput.objectiveText : undefined,
        }
      : undefined;

    // Create export record
    const exportRecord = await prisma.export.create({
      data: {
        auditId,
        exportType,
        format,
        language,
        status: "processing",
        planId: planId ?? null,
        isAdmin: adminStatus,
      },
    });

    try {
      // Generate the artifact
      const { bytes, contentType, ext } = await generateExport(
        exportType as ExportModuleId,
        format as ExportFormat,
        language,
        results,
        exportUserInput
      );

      // Upload to Supabase Storage
      const storagePath = await uploadExport(
        auditId,
        exportRecord.id,
        ext,
        bytes,
        contentType
      );

      // Update record to ready
      await prisma.export.update({
        where: { id: exportRecord.id },
        data: { status: "ready", fileUrl: storagePath },
      });

      return NextResponse.json({
        exportId: exportRecord.id,
        status: "ready",
      });
    } catch (genErr) {
      // Generation or upload failed
      const errorMessage =
        genErr instanceof Error ? genErr.message : "Unknown error";
      await prisma.export.update({
        where: { id: exportRecord.id },
        data: { status: "failed", errorMessage },
      });

      return NextResponse.json({
        exportId: exportRecord.id,
        status: "failed",
        error: errorMessage,
      });
    }
  } catch (err) {
    console.error("POST /api/exports/create error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
