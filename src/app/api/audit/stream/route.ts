import { NextResponse } from "next/server";
import { generateAuditResults } from "@/lib/services/audit-orchestrator";
import { validateAndPrepareInput } from "../generate/shared";
import type { Locale, PlanId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const validation = await validateAndPrepareInput(request);

    // If validation returned a NextResponse, it's an error — return it
    if (validation instanceof NextResponse) {
      return validation;
    }

    const { parsed, effectiveIsAdmin } = validation;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          } catch {
            // Controller may be closed if client disconnected
          }
        };

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
            // Progress callback → SSE events
            (progress) => {
              send("progress", progress);
            }
          );

          // P0-1: Route-level diagnostic log
          console.log(
            `[route] /api/audit/stream | ` +
            `status=200 | ` +
            `duration=${result.meta.durationMs}ms | ` +
            `model=${result.meta.modelUsed} | ` +
            `fallbacks=${result.meta.fallbackCount} | ` +
            `degraded=${result.meta.degraded} | ` +
            `sections=${result.meta.sectionCountGenerated} | ` +
            `failures=[${result.meta.failureReasons.join(",")}]`
          );

          send("complete", { results: result.results, meta: result.meta });
        } catch (err) {
          console.error("POST /api/audit/stream generation error:", err);
          send("error", {
            error: err instanceof Error ? err.message : "Generation failed. Please try again.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("POST /api/audit/stream error:", err);
    return NextResponse.json(
      { error: "Generation failed. Please try again." },
      { status: 500 }
    );
  }
}
