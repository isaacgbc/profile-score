import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/services/admin-guard";
import { prisma } from "@/lib/db/client";

const MAX_RANGE_DAYS = 90;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(request: Request) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);

    // ── Date range ──
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    const fromDate = fromStr ? new Date(`${fromStr}T00:00:00Z`) : defaultFrom;
    const toDate = toStr ? new Date(`${toStr}T23:59:59.999Z`) : now;

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json({ error: "Invalid date format." }, { status: 400 });
    }
    const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000);
    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `Max ${MAX_RANGE_DAYS} days.` }, { status: 400 });
    }

    // ── Filters ──
    const level = searchParams.get("level"); // error | warn | fatal
    const source = searchParams.get("source");
    const code = searchParams.get("code");
    const resolved = searchParams.get("resolved"); // "true" | "false"

    // ── Pagination ──
    const limitParam = parseInt(searchParams.get("limit") ?? "");
    const offsetParam = parseInt(searchParams.get("offset") ?? "");
    const limit = Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : Math.max(1, limitParam), MAX_LIMIT);
    const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

    // ── Build where clause ──
    const where: Record<string, unknown> = {
      createdAt: { gte: fromDate, lte: toDate },
    };
    if (level) where.level = level;
    if (source) where.source = { contains: source };
    if (code) where.code = code;
    if (resolved === "true") where.resolved = true;
    if (resolved === "false") where.resolved = false;

    // ── Query ──
    const [errors, total, countByLevel, countByCode, countBySource] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.errorLog.count({ where }),
      prisma.errorLog.groupBy({
        by: ["level"],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: true,
      }),
      prisma.errorLog.groupBy({
        by: ["code"],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: true,
        orderBy: { _count: { code: "desc" } },
        take: 10,
      }),
      prisma.errorLog.groupBy({
        by: ["source"],
        where: { createdAt: { gte: fromDate, lte: toDate } },
        _count: true,
        orderBy: { _count: { source: "desc" } },
        take: 10,
      }),
    ]);

    // ── Unresolved count (all time) ──
    const unresolvedCount = await prisma.errorLog.count({
      where: { resolved: false },
    });

    return NextResponse.json({
      errors,
      total,
      unresolvedCount,
      summary: {
        byLevel: Object.fromEntries(countByLevel.map((r) => [r.level, r._count])),
        byCode: Object.fromEntries(countByCode.map((r) => [r.code ?? "UNKNOWN", r._count])),
        bySource: Object.fromEntries(countBySource.map((r) => [r.source, r._count])),
      },
      pagination: { limit, offset, hasMore: offset + errors.length < total },
      period: { from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) },
    });
  } catch (err) {
    console.error("GET /api/admin/errors:", err);
    return NextResponse.json({ error: "Failed to fetch error logs." }, { status: 500 });
  }
}
