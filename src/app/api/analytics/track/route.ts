import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { TrackEventInput } from "@/lib/schemas/analytics";
import { createRateLimiter } from "@/lib/services/rate-limiter";

/**
 * Rate limiter: 20 requests/min per key.
 * Key = IP address + session ID fallback for robust throttling.
 */
const analyticsLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
});

function getThrottleKey(request: Request, sessionId?: string): string {
  // Prefer forwarded IP (Vercel / proxy), fall back to session
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  const session = sessionId ?? "no-session";
  return `${ip}:${session}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = TrackEventInput.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    // Rate-limit with ip+session composite key
    const throttleKey = getThrottleKey(request, parsed.data.sessionId);
    const limit = analyticsLimiter.check(throttleKey);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(limit.retryAfter ?? 60),
          },
        }
      );
    }

    await prisma.analyticsEvent.create({
      data: {
        eventName: parsed.data.eventName,
        sessionId: parsed.data.sessionId ?? null,
        userId: parsed.data.userId ?? null,
        auditId: parsed.data.auditId ?? null,
        planId: parsed.data.planId ?? null,
        sourceType: parsed.data.sourceType ?? null,
        locale: parsed.data.locale ?? null,
        metadata: (parsed.data.metadata as Prisma.InputJsonValue) ?? undefined,
        path: parsed.data.path ?? null,
        userAgent: parsed.data.userAgent ?? null,
        referrer: parsed.data.referrer ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/analytics/track error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
