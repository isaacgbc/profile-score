import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { mockExportModules } from "@/lib/mock/export-modules";
import { mockPlans } from "@/lib/mock/plans";
import { isServerAdmin } from "@/lib/services/admin-guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ auditId: string }> }
) {
  try {
    const { auditId } = await params;
    const adminStatus = isServerAdmin(request);

    // Get the audit to find the plan
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
    });

    if (!audit) {
      return NextResponse.json(
        { error: "Audit not found" },
        { status: 404 }
      );
    }

    // Get all exports for this audit
    const exports = await prisma.export.findMany({
      where: { auditId },
      orderBy: { createdAt: "desc" },
    });

    // Build modules response
    const plan = audit.planId
      ? mockPlans.find((p) => p.id === audit.planId)
      : null;

    const modules = mockExportModules.map((mod) => {
      const unlocked =
        adminStatus || (plan?.exportModules.includes(mod.id) ?? false);
      const moduleExports = exports
        .filter((e) => e.exportType === mod.id)
        .map((e) => ({
          exportId: e.id,
          status: e.status,
          exportType: e.exportType,
          format: e.format,
          language: e.language,
          fileUrl: e.fileUrl,
          error: e.errorMessage,
          createdAt: e.createdAt.toISOString(),
        }));

      return {
        moduleId: mod.id,
        unlocked,
        exports: moduleExports,
      };
    });

    return NextResponse.json({ auditId, modules });
  } catch (err) {
    console.error("GET /api/exports/audit/[auditId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
