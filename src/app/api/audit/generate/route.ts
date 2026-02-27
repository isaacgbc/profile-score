import { NextResponse } from "next/server";
import { generateAuditResults } from "@/lib/services/audit-orchestrator";
import { validateAndPrepareInput } from "./shared";
import type { Locale, PlanId } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const validation = await validateAndPrepareInput(request);

    // If validation returned a NextResponse, it's an error — return it
    if (validation instanceof NextResponse) {
      return validation;
    }

    const { parsed, effectiveIsAdmin } = validation;

    const result = await generateAuditResults(
      {
        linkedinText: parsed.linkedinText,
        cvText: parsed.cvText,
        jobDescription: parsed.jobDescription,
        targetAudience: parsed.targetAudience,
        objectiveMode: parsed.objectiveMode,
        objectiveText: parsed.objectiveText,
        planId: parsed.planId as PlanId | null,
        isAdmin: effectiveIsAdmin,
        forceFresh: parsed.forceFresh,
        isPdfSource: parsed.isPdfSource,
      },
      parsed.locale as Locale
    );

    // P0-1: Route-level diagnostic log
    console.log(
      `[route] /api/audit/generate | ` +
      `status=200 | ` +
      `duration=${result.meta.durationMs}ms | ` +
      `model=${result.meta.modelUsed} | ` +
      `fallbacks=${result.meta.fallbackCount} | ` +
      `degraded=${result.meta.degraded} | ` +
      `sections=${result.meta.sectionCountGenerated} | ` +
      `failures=[${result.meta.failureReasons.join(",")}]`
    );

    return NextResponse.json({
      results: result.results,
      meta: result.meta,
    });
  } catch (err) {
    console.error("POST /api/audit/generate error:", err);
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }
}
