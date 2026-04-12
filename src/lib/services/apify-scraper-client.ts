/**
 * Apify Scraper Client — thin wrapper around ApifyClient for LinkedIn profile scraping.
 *
 * This is the ONLY module that imports `apify-client`. All other modules (route handlers,
 * orchestrator) call `scrapeLinkedinProfile()` and receive typed results or typed errors.
 *
 * Features:
 * - Dedicated circuit breaker (apifyCircuitBreaker) — fast-fail when Apify is down
 * - Typed error codes: APIFY_CIRCUIT_OPEN, APIFY_RUN_*, APIFY_PROFILE_PRIVATE,
 *   APIFY_TOKEN_MISSING, APIFY_SCRAPE_FAILED
 * - Cost tracking via run.usageTotalUsd with fallback to APIFY_COST_PER_SCRAPE
 * - Schema validation of response items via harvestProfileSchema (defensive, passthrough)
 * - All errors routed through logError() with sanitized inputMeta (never raw URLs or tokens)
 *
 * Per 01-CONTEXT.md D-01, D-02, D-06, D-07, D-25, D-26.
 * Per 01-RESEARCH.md Pattern 1 (lines 184-246).
 */
import { ApifyClient } from "apify-client";
import crypto from "crypto";
import { apifyCircuitBreaker } from "./circuit-breaker";
import { logError } from "./error-logger";
import { harvestProfileSchema } from "@/lib/schemas/linkedin-profile";

// ── Constants ────────────────────────────────────────────────
export const APIFY_ACTOR_ID = "harvestapi/linkedin-profile-scraper";
export const APIFY_COST_PER_SCRAPE = 0.004;

const APIFY_WAIT_SECS = 50;
const APIFY_TIMEOUT_SECS = 55;
const APIFY_MEMORY_MB = 512;

// ── Types ────────────────────────────────────────────────────
export interface ScrapeLinkedinParams {
  profileUrl: string;
  requestId: string;
}

export interface ScrapeLinkedinResult {
  runId: string;
  items: unknown[];
  costUsd: number;
}

// ── Main function ────────────────────────────────────────────
export async function scrapeLinkedinProfile(
  params: ScrapeLinkedinParams,
): Promise<ScrapeLinkedinResult> {
  const startedAt = Date.now();

  // 1. Token check (at call time, NOT module load — so tests can set env in beforeEach)
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    logError({
      level: "error",
      source: "services/apify-scraper-client",
      message: "APIFY_API_TOKEN is not set",
      code: "APIFY_SCRAPE_FAILED",
      requestId: params.requestId,
    });
    throw new Error("APIFY_TOKEN_MISSING");
  }

  // 2. Circuit breaker check
  if (!apifyCircuitBreaker.allowRequest()) {
    logError({
      level: "warn",
      source: "services/apify-scraper-client",
      message: "Apify circuit breaker is OPEN — rejecting request",
      code: "CIRCUIT_OPEN",
      requestId: params.requestId,
    });
    throw new Error("APIFY_CIRCUIT_OPEN");
  }

  // 3. Build client per-call (cheap constructor, enables easy test mocking via vi.mock)
  const client = new ApifyClient({ token });

  try {
    // 4. Call the actor
    // Per 01-01-SUMMARY: actor uses `queries` (not `profileUrls`) and requires `profileScraperMode`
    const run = await client.actor(APIFY_ACTOR_ID).call(
      {
        queries: [params.profileUrl],
        profileScraperMode: "Profile details no email ($4 per 1k)",
      },
      {
        waitSecs: APIFY_WAIT_SECS,
        timeout: APIFY_TIMEOUT_SECS,
        memory: APIFY_MEMORY_MB,
      },
    );

    // 5. Check run status
    if (run.status !== "SUCCEEDED") {
      const isTransient = run.status === "TIMED-OUT";
      apifyCircuitBreaker.recordFailure(isTransient);
      logError({
        level: "error",
        source: "services/apify-scraper-client",
        message: `Apify run ${run.status}: ${run.id}`,
        code: "APIFY_SCRAPE_FAILED",
        requestId: params.requestId,
        inputMeta: {
          durationMs: Date.now() - startedAt,
          transient: isTransient,
          runStatus: run.status,
          urlHash: hashUrl(params.profileUrl),
        },
      });
      throw new Error(`APIFY_RUN_${run.status}`);
    }

    // 6. Fetch dataset items
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // 7. Private profile detection: empty items or missing headline
    if (
      items.length === 0 ||
      !(items[0] as Record<string, unknown>)?.headline
    ) {
      apifyCircuitBreaker.recordFailure(false);
      logError({
        level: "warn",
        source: "services/apify-scraper-client",
        message: "Profile appears private (empty items or missing headline)",
        code: "APIFY_SCRAPE_FAILED",
        requestId: params.requestId,
        inputMeta: {
          durationMs: Date.now() - startedAt,
          transient: false,
          itemCount: items.length,
          urlHash: hashUrl(params.profileUrl),
        },
      });
      throw new Error("APIFY_PROFILE_PRIVATE");
    }

    // 8. Schema validation (defensive — log warning but still return items)
    const parsed = harvestProfileSchema.safeParse(items[0]);
    if (!parsed.success) {
      logError({
        level: "warn",
        source: "services/apify-scraper-client",
        message: `Schema validation warning: ${parsed.error.issues.length} issues`,
        code: "APIFY_SCRAPE_FAILED",
        requestId: params.requestId,
        inputMeta: {
          issueCount: parsed.error.issues.length,
          urlHash: hashUrl(params.profileUrl),
        },
      });
    }

    // 9. Success — record on circuit breaker
    apifyCircuitBreaker.recordSuccess();

    return {
      runId: run.id,
      items,
      costUsd: Number(run.usageTotalUsd ?? APIFY_COST_PER_SCRAPE),
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errMsg = err instanceof Error ? err.message : "unknown";

    // If this is one of our typed errors, re-throw without double-logging
    if (
      errMsg === "APIFY_TOKEN_MISSING" ||
      errMsg === "APIFY_CIRCUIT_OPEN" ||
      errMsg.startsWith("APIFY_RUN_") ||
      errMsg === "APIFY_PROFILE_PRIVATE"
    ) {
      throw err;
    }

    // External/network error — classify transient
    const msgLower = errMsg.toLowerCase();
    const transient =
      msgLower.includes("429") ||
      msgLower.includes("timeout") ||
      msgLower.includes("econnreset");

    apifyCircuitBreaker.recordFailure(transient);

    logError({
      level: "error",
      source: "services/apify-scraper-client",
      message: `Apify scrape failed: ${errMsg}`,
      error: err,
      code: "APIFY_SCRAPE_FAILED",
      requestId: params.requestId,
      inputMeta: {
        durationMs,
        transient,
        urlHash: hashUrl(params.profileUrl),
      },
    });

    throw err;
  }
}

// ── Helpers ──────────────────────────────────────────────────

/** Hash URL for safe logging — never log raw profile URLs */
function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}
