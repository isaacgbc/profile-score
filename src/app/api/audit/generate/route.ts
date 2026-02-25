import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { generateAuditResults } from "@/lib/services/audit-orchestrator";
import { createRateLimiter } from "@/lib/services/rate-limiter";
import { llmCircuitBreaker } from "@/lib/services/circuit-breaker";
import { validateAdminCookie } from "@/lib/services/admin-session";
import { isOwnerEmail } from "@/lib/services/owner-allowlist";
import { createClient } from "@/lib/supabase/server";
import type { Locale, PlanId } from "@/lib/types";

// ── Hard caps per source (bytes) ─────────────────────────
const MAX_LINKEDIN_BYTES = 100_000; // ~100 KB
const MAX_CV_BYTES = 200_000; // ~200 KB
const MAX_JOB_DESC_BYTES = 20_000; // ~20 KB
const MAX_BODY_BYTES = 500_000; // ~500 KB total

/**
 * Per-IP rate limiters (sliding window):
 * - Burst:  5 req / 1 min  (prevents hammering)
 * - Hourly: 20 req / 1 hr  (prevents sustained abuse)
 * - Daily:  50 req / 24 hr (hard daily cap)
 */
const burstLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 5,
});
const hourlyLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  maxRequests: 20,
});
const dailyLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60_000,
  maxRequests: 50,
});

// ── Input validation ──────────────────────────────────
const GenerateAuditInput = z.object({
  linkedinText: z.string().max(50_000).default(""),
  cvText: z.string().max(50_000).optional(),
  jobDescription: z.string().max(5_000).default(""),
  targetAudience: z.string().max(1_000).default(""),
  objectiveMode: z.enum(["job", "objective"]).default("job"),
  objectiveText: z.string().max(2_000).default(""),
  planId: z.string().max(50).nullable().default(null),
  isAdmin: z.boolean().default(false),
  locale: z.enum(["en", "es"]).default("en"),
  /** P0-4: bypass cache and force fresh LLM generation */
  forceFresh: z.boolean().default(false),
});

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  try {
    // ── Hard cap: total body size ──
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body too large", maxBytes: MAX_BODY_BYTES },
        { status: 413 }
      );
    }

    const body = await request.json();
    const parsed = GenerateAuditInput.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // ── Hard cap: per-source byte limits ──
    const linkedinBytes = new TextEncoder().encode(parsed.data.linkedinText).length;
    const cvBytes = new TextEncoder().encode(parsed.data.cvText ?? "").length;
    const jobDescBytes = new TextEncoder().encode(parsed.data.jobDescription).length;

    if (linkedinBytes > MAX_LINKEDIN_BYTES) {
      return NextResponse.json(
        { error: "LinkedIn text too large", maxBytes: MAX_LINKEDIN_BYTES, actualBytes: linkedinBytes },
        { status: 413 }
      );
    }
    if (cvBytes > MAX_CV_BYTES) {
      return NextResponse.json(
        { error: "CV text too large", maxBytes: MAX_CV_BYTES, actualBytes: cvBytes },
        { status: 413 }
      );
    }
    if (jobDescBytes > MAX_JOB_DESC_BYTES) {
      return NextResponse.json(
        { error: "Job description too large", maxBytes: MAX_JOB_DESC_BYTES, actualBytes: jobDescBytes },
        { status: 413 }
      );
    }

    // ── Tiered rate limiting (check daily → hourly → burst) ──
    const ip = getClientIp(request);

    const daily = dailyLimiter.check(ip);
    if (!daily.allowed) {
      return NextResponse.json(
        { error: "Daily generation limit reached. Try again tomorrow.", quota: "50/day" },
        { status: 429, headers: { "Retry-After": String(daily.retryAfter ?? 3600) } }
      );
    }

    const hourly = hourlyLimiter.check(ip);
    if (!hourly.allowed) {
      return NextResponse.json(
        { error: "Hourly generation limit reached. Try again later.", quota: "20/hour" },
        { status: 429, headers: { "Retry-After": String(hourly.retryAfter ?? 600) } }
      );
    }

    const burst = burstLimiter.check(ip);
    if (!burst.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment.", quota: "5/min" },
        { status: 429, headers: { "Retry-After": String(burst.retryAfter ?? 60) } }
      );
    }

    // ── Circuit breaker status (diagnostic log) ──
    const cbStats = llmCircuitBreaker.getStats();
    if (cbStats.state !== "CLOSED") {
      console.warn(
        `[generate] Circuit breaker ${cbStats.state} | ` +
        `hardFailures=${cbStats.hardFailures} transient=${cbStats.transientFailures} ` +
        `total=${cbStats.totalCalls} rate=${(cbStats.hardFailureRate * 100).toFixed(1)}% | ` +
        `cooldown=${cbStats.cooldownRemainingMs}ms | ` +
        `lastOpenReason=${cbStats.lastOpenReason}`
      );
    }

    // Validate that at least some input is provided
    const hasLinkedin = parsed.data.linkedinText.trim().length > 20;
    const hasCv =
      parsed.data.cvText !== undefined &&
      parsed.data.cvText.trim().length > 20;

    if (!hasLinkedin && !hasCv) {
      return NextResponse.json(
        { error: "Please upload a LinkedIn PDF or CV, or paste your profile text to analyze." },
        { status: 400 }
      );
    }

    // ── Server-side admin validation ──
    // Trust admin if: (1) valid admin cookie, OR (2) allowlisted email from authenticated session
    let effectiveIsAdmin = false;
    if (parsed.data.isAdmin) {
      const cookieStore = await cookies();
      const adminCookie = cookieStore.get("ps_admin_session")?.value;
      effectiveIsAdmin = adminCookie ? validateAdminCookie(adminCookie) : false;

      // Fallback: check if authenticated user is in owner allowlist
      if (!effectiveIsAdmin) {
        try {
          const supabase = await createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user && isOwnerEmail(user.email)) {
            effectiveIsAdmin = true;
          }
        } catch {
          // Supabase auth check failed — fall through to cookie-only
        }
      }

      if (!effectiveIsAdmin) {
        console.warn(`[generate] Client sent isAdmin=true but no valid admin cookie or allowlisted session`);
      }
    }

    const result = await generateAuditResults(
      {
        linkedinText: parsed.data.linkedinText,
        cvText: parsed.data.cvText,
        jobDescription: parsed.data.jobDescription,
        targetAudience: parsed.data.targetAudience,
        objectiveMode: parsed.data.objectiveMode,
        objectiveText: parsed.data.objectiveText,
        planId: parsed.data.planId as PlanId | null,
        isAdmin: effectiveIsAdmin,
        forceFresh: parsed.data.forceFresh,
      },
      parsed.data.locale as Locale
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
