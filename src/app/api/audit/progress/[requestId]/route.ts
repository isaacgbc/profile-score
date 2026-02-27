import { NextResponse } from "next/server";
import { getProgress } from "@/lib/services/progress-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sprint 2.2: Poll-based progress endpoint.
 *
 * GET /api/audit/progress/:requestId
 *
 * Returns the current generation progress for a given requestId.
 * The client polls this every 1-2s during generation.
 *
 * Response shape:
 * {
 *   found: boolean,
 *   stage, percent, label,
 *   completedSections: SectionPair[],
 *   totalSections: number,
 *   isComplete: boolean,
 *   error: string | null,
 *   finalResults?: { results, meta }
 * }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  if (!requestId || requestId.length < 4 || requestId.length > 40) {
    return NextResponse.json(
      { found: false, error: "Invalid requestId" },
      { status: 400 }
    );
  }

  const progress = getProgress(requestId);

  if (!progress) {
    return NextResponse.json(
      { found: false },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  return NextResponse.json(
    {
      found: true,
      stage: progress.stage,
      percent: progress.percent,
      label: progress.label,
      completedSections: progress.completedSections,
      totalSections: progress.totalSections,
      isComplete: progress.isComplete,
      error: progress.error,
      // Only include finalResults when generation is complete
      ...(progress.isComplete && progress.finalResults
        ? { finalResults: progress.finalResults }
        : {}),
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
