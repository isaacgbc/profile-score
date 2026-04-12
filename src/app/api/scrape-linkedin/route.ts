/**
 * POST /api/scrape-linkedin — LinkedIn profile scraping via Apify.
 *
 * Orchestration order (per D-13):
 * fingerprint -> rate limit -> URL normalize -> cache read -> quota check
 * -> scrape -> cache write -> consume quota -> log usage -> format -> respond
 *
 * On cache HIT: return cached data WITHOUT consuming quota.
 * APIFY_ENABLED kill switch: must be "true" to proceed.
 *
 * @see 01-CONTEXT.md D-03, D-05, D-13, D-15, D-23
 * @see 01-07-PLAN.md — full pipeline specification
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scrapeLinkedinRequestSchema } from "@/lib/schemas/linkedin-profile";
import { extractRequestMeta, logError } from "@/lib/services/error-logger";
import { scrapeRateLimiter } from "@/lib/services/rate-limiter";
import {
  normalizeLinkedinUrl,
  hashUrl,
  readCache,
  writeCache,
} from "@/lib/services/apify-cache";
import { computeFingerprint } from "@/lib/services/apify-fingerprint";
import { scrapeLinkedinProfile } from "@/lib/services/apify-scraper-client";
import {
  checkQuota,
  consumeQuota,
  getQuotaState,
  logUsage,
} from "@/lib/services/apify-quota";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const { ip, userAgent } = extractRequestMeta(request);

  // Kill switch — APIFY_ENABLED must be explicitly "true"
  if (process.env.APIFY_ENABLED !== "true") {
    return NextResponse.json({ error: "APIFY_DISABLED" }, { status: 503 });
  }

  let normalizedUrl: string | null = null;
  let urlHash: string | null = null;
  let userId: string | null = null;
  let fingerprintHash: string | null = null;
  let cacheHit = false;
  let apifyRunId: string | null = null;
  let costUsd = 0;
  let success = false;
  let errorCode: string | null = null;

  try {
    // 1. Parse + validate body
    const body = await request.json().catch(() => ({}));
    const parsed = scrapeLinkedinRequestSchema.safeParse(body);
    if (!parsed.success) {
      errorCode = "APIFY_INVALID_URL";
      return NextResponse.json({ error: errorCode }, { status: 400 });
    }

    // 2. Auth lookup (optional -- anonymous allowed)
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null; // anonymous fallback
    }

    // 3. Fingerprint (used as rate limit key + anon quota key)
    fingerprintHash = computeFingerprint(ip ?? "unknown", userAgent);

    // 4. Rate limit check (cost abuse defense)
    const rate = scrapeRateLimiter.check(fingerprintHash);
    if (!rate.allowed) {
      errorCode = "APIFY_RATE_LIMITED";
      return NextResponse.json(
        { error: errorCode, retryAfter: rate.retryAfter ?? 60 },
        { status: 429 },
      );
    }

    // 5. URL normalization (also validates shape -- throws APIFY_INVALID_URL)
    try {
      normalizedUrl = normalizeLinkedinUrl(parsed.data.url);
    } catch {
      errorCode = "APIFY_INVALID_URL";
      return NextResponse.json({ error: errorCode }, { status: 400 });
    }
    urlHash = hashUrl(normalizedUrl);

    // 6. Cache read
    const cached = await readCache(normalizedUrl);
    let profileData: unknown;
    if (cached) {
      cacheHit = true;
      profileData = cached;
    } else {
      // 7. Quota check (only on miss)
      await checkQuota({ userId, fingerprintHash, isCacheHit: false });

      // 8. Apify call
      const result = await scrapeLinkedinProfile({
        profileUrl: normalizedUrl,
        requestId,
      });
      apifyRunId = result.runId;
      costUsd = result.costUsd;
      profileData = result.items[0];

      // 9. Cache write
      await writeCache({
        normalizedUrl,
        profileData,
        apifyRunId,
        costUsd,
      });

      // 10. Consume quota (post-scrape, only on success)
      await consumeQuota({ userId, fingerprintHash });
    }

    // 11. Return quota state for client dashboard chip
    const quotaState = await getQuotaState({ userId, fingerprintHash });

    success = true;
    return NextResponse.json({
      profile: profileData,
      cached: cacheHit,
      quotaRemaining: quotaState.remaining,
      plan: quotaState.plan,
      source: "apify",
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    errorCode = classifyError(raw);
    const status = statusForError(errorCode);

    logError({
      level: "error",
      source: "api/scrape-linkedin",
      message: raw,
      error: err,
      code: errorCode as any,
      statusCode: status,
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
      requestId,
      inputMeta: {
        urlHash: urlHash ?? undefined,
        cacheHit,
        costUsd,
        durationMs: Date.now() - startedAt,
      },
    });

    return NextResponse.json({ error: errorCode }, { status });
  } finally {
    // 12. Append-only usage log (fire-and-forget -- will not crash on failure)
    void logUsage({
      userId,
      fingerprintHash,
      url: normalizedUrl,
      urlHash,
      cacheHit,
      apifyRunId,
      costUsd,
      success,
      errorCode,
      durationMs: Date.now() - startedAt,
    });
  }
}

// ── Error Classification ────────────────────────────────────────

function classifyError(raw: string): string {
  const m = raw.match(/APIFY_[A-Z_]+/);
  if (m) {
    if (m[0].startsWith("APIFY_RUN_TIMED")) return "APIFY_DOWNTIME";
    if (m[0] === "APIFY_RUN_FAILED") return "APIFY_SCRAPE_FAILED";
    if (m[0] === "APIFY_TOKEN_MISSING") return "APIFY_DISABLED";
    return m[0];
  }
  return "APIFY_SCRAPE_FAILED";
}

function statusForError(code: string): number {
  switch (code) {
    case "APIFY_INVALID_URL":
      return 400;
    case "APIFY_QUOTA_EXCEEDED":
      return 402;
    case "APIFY_PROFILE_PRIVATE":
      return 422;
    case "APIFY_RATE_LIMITED":
      return 429;
    case "APIFY_DOWNTIME":
    case "APIFY_CIRCUIT_OPEN":
    case "APIFY_DISABLED":
      return 503;
    default:
      return 500;
  }
}
