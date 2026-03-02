import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { assertAdmin } from "@/lib/services/admin-guard";

/**
 * GET /api/admin/feedback
 *
 * Queries analytics events for feedback_submitted and bug_report_submitted.
 * Supports pagination, type filter, and date range.
 */
export async function GET(request: Request) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "feedback" | "bugs" | null (both)
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

  // Determine which event names to query
  const eventNames: string[] = [];
  if (type === "feedback") eventNames.push("feedback_submitted");
  else if (type === "bugs") eventNames.push("bug_report_submitted");
  else eventNames.push("feedback_submitted", "bug_report_submitted");

  // Build date filter
  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    dateFilter.lte = toDate;
  }

  try {
    const where = {
      eventName: { in: eventNames },
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          eventName: true,
          sessionId: true,
          metadata: true,
          path: true,
          userAgent: true,
          createdAt: true,
        },
      }),
      prisma.analyticsEvent.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("GET /api/admin/feedback error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
