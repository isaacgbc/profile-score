import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { assertAdmin } from "@/lib/services/admin-guard";

/**
 * Funnel steps in order. Used for conversion calculation.
 */
const FUNNEL_STEPS = [
  "landing_view",
  "start_audit",
  "audit_completed",
  "plan_selected",
  "checkout_opened",
  "export_clicked",
] as const;

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 7;

function parseDateParam(
  value: string | null,
  fallback: Date,
  endOfDay = false
): Date {
  if (!value) return fallback;
  const d = new Date(value);
  if (isNaN(d.getTime())) return fallback;
  // When the value is a date-only string (YYYY-MM-DD) used as an end bound,
  // push to 23:59:59.999 so the entire day is included.
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

export async function GET(request: Request) {
  // Admin gate
  const forbidden = assertAdmin(request);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - DEFAULT_RANGE_DAYS * 86_400_000);

  const from = parseDateParam(searchParams.get("from"), defaultFrom);
  const to = parseDateParam(searchParams.get("to"), now, true);

  // Validate max 90-day range
  const rangeDays = (to.getTime() - from.getTime()) / 86_400_000;
  if (rangeDays > MAX_RANGE_DAYS || rangeDays < 0) {
    return NextResponse.json(
      {
        error: `Date range must be between 0 and ${MAX_RANGE_DAYS} days. Got ${Math.round(rangeDays)} days.`,
      },
      { status: 400 }
    );
  }

  try {
    // Count events grouped by event_name within the date range
    const counts = await prisma.analyticsEvent.groupBy({
      by: ["eventName"],
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      _count: { id: true },
    });

    // Build counts map
    const countMap: Record<string, number> = {};
    for (const row of counts) {
      countMap[row.eventName] = row._count.id;
    }

    // Build funnel chain with conversion ratios
    const funnel = FUNNEL_STEPS.map((step, i) => {
      const count = countMap[step] ?? 0;
      const previousCount = i > 0 ? (countMap[FUNNEL_STEPS[i - 1]] ?? 0) : count;
      const conversionFromPrevious =
        i === 0 || previousCount === 0
          ? 1
          : count / previousCount;

      return {
        step,
        count,
        conversionFromPrevious: Math.round(conversionFromPrevious * 10000) / 100, // e.g. 85.23%
      };
    });

    // Unique sessions
    const uniqueSessionsResult = await prisma.analyticsEvent.groupBy({
      by: ["sessionId"],
      where: {
        createdAt: { gte: from, lte: to },
        sessionId: { not: null },
      },
    });

    // Total events
    const totalEvents = await prisma.analyticsEvent.count({
      where: {
        createdAt: { gte: from, lte: to },
      },
    });

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      counts: countMap,
      funnel,
      uniqueSessions: uniqueSessionsResult.length,
      totalEvents,
    });
  } catch (err) {
    console.error("GET /api/analytics/funnel error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
