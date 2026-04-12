/**
 * Apify quota enforcement service.
 *
 * Centralizes ALL quota logic for LinkedIn scraping:
 * - checkQuota: throws APIFY_QUOTA_EXCEEDED if caller is over limit
 * - consumeQuota: increments the appropriate counter after successful scrape
 * - getQuotaState: returns remaining count for dashboard display (read-only)
 * - logUsage: append-only audit log to ApifyUsageLog
 *
 * Quota tiers:
 * - Paid (starter/recommended): apifyScrapeQuota = null -> unlimited
 * - Free authenticated: apifyScrapeQuota = 1, checked against apifyScrapeCount
 * - Free anonymous: 1 scrape per fingerprint lifetime (AnonymousApifyUsage)
 *
 * Cache hits short-circuit all quota checks (no consumption).
 *
 * @see CONTEXT.md D-13 (quota order), D-14 (paid unlimited), D-15 (HTTP 402)
 * @see CONTEXT.md D-11 (anonymous tracking by fingerprintHash)
 */
import { prisma } from "@/lib/db/client";

/** Free tier: 1 scrape per user/fingerprint lifetime */
export const APIFY_FREE_QUOTA = 1;

export type QuotaCallerContext = {
  userId?: string | null;
  fingerprintHash?: string | null;
};

/**
 * Check whether the caller is allowed to scrape.
 *
 * Call BEFORE invoking Apify. Cache hits short-circuit (no DB lookups).
 *
 * @throws {Error} with message "APIFY_QUOTA_EXCEEDED" if over limit
 */
export async function checkQuota(
  ctx: QuotaCallerContext & { isCacheHit: boolean },
): Promise<void> {
  // D-13: cache hit = no quota consumption
  if (ctx.isCacheHit) return;

  // Authenticated user path
  if (ctx.userId) {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
    });
    // T-06-07: safe default — unknown caller denied
    if (!user) throw new Error("APIFY_QUOTA_EXCEEDED");
    // D-14: paid tier (apifyScrapeQuota = null) = unlimited
    if (user.apifyScrapeQuota === null) return;
    // Free tier: check count vs quota
    if (user.apifyScrapeCount >= user.apifyScrapeQuota) {
      throw new Error("APIFY_QUOTA_EXCEEDED");
    }
    return;
  }

  // Anonymous user path (D-11)
  if (ctx.fingerprintHash) {
    const row = await prisma.anonymousApifyUsage.findUnique({
      where: { fingerprintHash: ctx.fingerprintHash },
    });
    // No record = first scrape allowed
    if (row && row.scrapeCount >= APIFY_FREE_QUOTA) {
      throw new Error("APIFY_QUOTA_EXCEEDED");
    }
    return;
  }

  // T-06-07: fail-closed — neither userId nor fingerprintHash
  throw new Error("APIFY_QUOTA_EXCEEDED");
}

/**
 * Increment the appropriate counter after a successful Apify call.
 *
 * Call ONLY after the scrape succeeds. Never call on cache hits.
 */
export async function consumeQuota(ctx: QuotaCallerContext): Promise<void> {
  if (ctx.userId) {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
    });
    if (!user) return;
    await prisma.user.update({
      where: { id: ctx.userId },
      data: {
        apifyScrapeCount: { increment: 1 },
        // Only set apifyFirstScrapeAt on first scrape
        apifyFirstScrapeAt: user.apifyFirstScrapeAt ?? new Date(),
      },
    });
    return;
  }

  if (ctx.fingerprintHash) {
    const now = new Date();
    await prisma.anonymousApifyUsage.upsert({
      where: { fingerprintHash: ctx.fingerprintHash },
      create: {
        fingerprintHash: ctx.fingerprintHash,
        scrapeCount: 1,
        firstScrapeAt: now,
        lastScrapeAt: now,
      } as any,
      update: {
        scrapeCount: { increment: 1 },
        lastScrapeAt: now,
      },
    });
  }
}

/**
 * Get quota state for dashboard display. Read-only, never mutates.
 *
 * @returns remaining: number of scrapes left (null = unlimited for paid), plan tier name
 */
export async function getQuotaState(
  ctx: QuotaCallerContext,
): Promise<{
  remaining: number | null;
  plan: "free" | "starter" | "recommended";
}> {
  if (ctx.userId) {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
    });
    if (!user) return { remaining: 0, plan: "free" };
    // Paid tier: unlimited
    if (user.apifyScrapeQuota === null) {
      const plan =
        user.activePlanId === "recommended" ? "recommended" : "starter";
      return { remaining: null, plan };
    }
    return {
      remaining: Math.max(0, user.apifyScrapeQuota - user.apifyScrapeCount),
      plan: "free",
    };
  }

  if (ctx.fingerprintHash) {
    const row = await prisma.anonymousApifyUsage.findUnique({
      where: { fingerprintHash: ctx.fingerprintHash },
    });
    const used = row?.scrapeCount ?? 0;
    return { remaining: Math.max(0, APIFY_FREE_QUOTA - used), plan: "free" };
  }

  // T-06-07: fail-closed default
  return { remaining: 0, plan: "free" };
}

/**
 * Append-only audit log for every scrape attempt.
 *
 * Fire-and-forget: never crashes the caller on log failure.
 * Matches the logError() pattern from error-logger.ts (T-06-05).
 */
export async function logUsage(params: {
  userId?: string | null;
  fingerprintHash?: string | null;
  url: string | null;
  urlHash: string | null;
  cacheHit: boolean;
  apifyRunId?: string | null;
  costUsd: number;
  success: boolean;
  errorCode?: string | null;
  durationMs?: number | null;
}): Promise<void> {
  try {
    await prisma.apifyUsageLog.create({
      data: {
        userId: params.userId ?? null,
        fingerprintHash: params.fingerprintHash ?? null,
        url: params.url,
        urlHash: params.urlHash,
        cacheHit: params.cacheHit,
        apifyRunId: params.apifyRunId ?? null,
        costUsd: params.costUsd as unknown as any,
        success: params.success,
        errorCode: params.errorCode ?? null,
        durationMs: params.durationMs ?? null,
      },
    });
  } catch {
    // T-06-05: fire-and-forget — never crash the caller on log failure
  }
}
