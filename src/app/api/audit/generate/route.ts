import { NextResponse } from "next/server";
import { generateAuditResults } from "@/lib/services/audit-orchestrator";
import { validateAndPrepareInput } from "./shared";
import {
  initProgress,
  updateProgress,
  completeProgress,
  failProgress,
} from "@/lib/services/progress-store";
import type { Locale, PlanId } from "@/lib/types";

const ENABLE_PROGRESS_REGISTRY =
  process.env.ENABLE_PROGRESS_REGISTRY === "true";

export async function POST(request: Request) {
  try {
    const validation = await validateAndPrepareInput(request);

    // If validation returned a NextResponse, it's an error — return it
    if (validation instanceof NextResponse) {
      return validation;
    }

    const { parsed, effectiveIsAdmin } = validation;

    // Sprint 2.2: Use client-provided requestId for poll-based progress tracking.
    // Client generates the ID up-front so it can start polling immediately.
    const requestId =
      ENABLE_PROGRESS_REGISTRY && parsed.progressRequestId
        ? parsed.progressRequestId
        : undefined;

    if (requestId) {
      initProgress(requestId);
    }

    try {
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
        parsed.locale as Locale,
        // Sprint 2.2: Wire onProgress callback to update the progress store
        requestId
          ? (progress) => {
              updateProgress(requestId, progress);
            }
          : undefined
      );

      // Sprint 2.2: Mark generation as complete in progress store
      if (requestId) {
        completeProgress(
          requestId,
          result.results,
          result.meta as unknown as Record<string, unknown>
        );
      }

      // P0-1: Route-level diagnostic log
      console.log(
        `[route] /api/audit/generate | ` +
          `status=200 | ` +
          `requestId=${requestId ?? "none"} | ` +
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
        // Sprint 2.2: Include requestId so client can poll for progress
        ...(requestId ? { requestId } : {}),
      });
    } catch (err) {
      // Sprint 2.2: Mark generation as failed in progress store
      if (requestId) {
        const msg =
          err instanceof Error
            ? err.message
            : "Generation failed. Please try again.";
        failProgress(requestId, msg);
      }

      throw err;
    }
  } catch (err) {
    console.error("POST /api/audit/generate error:", err);
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }
}
