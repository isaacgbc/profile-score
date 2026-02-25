import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/services/admin-guard";
import { prisma } from "@/lib/db/client";

// ── Safeguards ──────────────────────────────────────────
const MAX_RANGE_DAYS = 90;
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

interface AuditResults {
  overallScore?: number;
  maxScore?: number;
  tier?: string;
}

type TierKey = "excellent" | "good" | "fair" | "poor";

const TIER_KEYS: TierKey[] = ["excellent", "good", "fair", "poor"];

const SCORE_BUCKET_LABELS = [
  "0-20",
  "21-40",
  "41-60",
  "61-80",
  "81-100",
] as const;

function getScoreBucket(score: number, maxScore: number): string {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct <= 20) return "0-20";
  if (pct <= 40) return "21-40";
  if (pct <= 60) return "41-60";
  if (pct <= 80) return "61-80";
  return "81-100";
}

export async function GET(request: Request) {
  // ── Admin auth ──
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);

    // ── Parse date range with defaults ──
    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 7);

    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const fromDate = fromStr ? new Date(`${fromStr}T00:00:00Z`) : defaultFrom;
    const toDate = toStr ? new Date(`${toStr}T23:59:59.999Z`) : now;

    // Validate dates
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD." },
        { status: 400 }
      );
    }

    if (fromDate > toDate) {
      return NextResponse.json(
        { error: "'from' must be before 'to'." },
        { status: 400 }
      );
    }

    // ── Max range safeguard ──
    const rangeDays = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (rangeDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        {
          error: `Date range too large. Max ${MAX_RANGE_DAYS} days.`,
          maxDays: MAX_RANGE_DAYS,
        },
        { status: 400 }
      );
    }

    // ── Parse pagination ──
    const limitParam = parseInt(searchParams.get("limit") ?? "");
    const offsetParam = parseInt(searchParams.get("offset") ?? "");
    const limit = Math.min(
      isNaN(limitParam) ? DEFAULT_LIMIT : Math.max(1, limitParam),
      MAX_LIMIT
    );
    const offset = isNaN(offsetParam) ? 0 : Math.max(0, offsetParam);

    // ── Query audits within date range ──
    const audits = await prisma.audit.findMany({
      where: {
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
      select: {
        id: true,
        results: true,
        modelUsed: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // ── Get total count for pagination ──
    const totalAudits = await prisma.audit.count({
      where: {
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    // ── Count fallback events in the same range ──
    const fallbackCount = await prisma.analyticsEvent.count({
      where: {
        eventName: "llm_fallback_used",
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    // ── Compute aggregates from results JSON ──
    const tierCounts: Record<TierKey, number> = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
    };

    const scoreBuckets: Record<string, number> = {};
    for (const label of SCORE_BUCKET_LABELS) {
      scoreBuckets[label] = 0;
    }

    let scoreSum = 0;
    let validScoreCount = 0;
    const modelCounts: Record<string, number> = {};

    for (const audit of audits) {
      const results = audit.results as AuditResults | null;
      if (!results) continue;

      // Tier counts
      const tier = results.tier as TierKey | undefined;
      if (tier && TIER_KEYS.includes(tier)) {
        tierCounts[tier]++;
      }

      // Score buckets & average
      const score = results.overallScore;
      const maxScore = results.maxScore;
      if (typeof score === "number" && typeof maxScore === "number" && maxScore > 0) {
        scoreBuckets[getScoreBucket(score, maxScore)]++;
        scoreSum += (score / maxScore) * 100;
        validScoreCount++;
      }

      // Model usage
      const model = audit.modelUsed ?? "unknown";
      modelCounts[model] = (modelCounts[model] ?? 0) + 1;
    }

    const avgScore =
      validScoreCount > 0
        ? Math.round((scoreSum / validScoreCount) * 10) / 10
        : 0;

    const fallbackRate =
      totalAudits > 0
        ? Math.round((fallbackCount / totalAudits) * 1000) / 1000
        : 0;

    return NextResponse.json({
      period: {
        from: fromDate.toISOString().slice(0, 10),
        to: toDate.toISOString().slice(0, 10),
      },
      tierCounts,
      scoreBuckets,
      avgScore,
      totalAudits,
      totalInPage: audits.length,
      fallbackCount,
      fallbackRate,
      modelCounts,
      pagination: {
        limit,
        offset,
        hasMore: offset + audits.length < totalAudits,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/eval-quality error:", err);
    return NextResponse.json(
      { error: "Failed to fetch eval quality data." },
      { status: 500 }
    );
  }
}
