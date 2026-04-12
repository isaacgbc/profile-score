/**
 * Integration tests for POST /api/scrape-linkedin route.
 *
 * All external dependencies mocked at the import boundary:
 * - Apify client (via apify-scraper-client mock)
 * - Prisma (via __mocks__/client.ts)
 * - Supabase auth
 * - Error logger
 *
 * Tests cover all error + success paths per 01-07-PLAN.md Task 2 behaviors (14 tests).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mocks (declared before vi.mock hoisting) ────────────────
const {
  mockGetUser,
  mockLogError,
  mockScrapeLinkedinProfile,
  mockRateLimitCheck,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(async () => ({ data: { user: null } })),
  mockLogError: vi.fn(),
  mockScrapeLinkedinProfile: vi.fn(),
  mockRateLimitCheck: vi.fn(() => ({ allowed: true })),
}));

// ── Top-level mocks (MUST be before any import of the route) ──────────

vi.mock("@/lib/db/client", () => import("@/lib/db/__mocks__/client"));

// Mock Supabase server auth — default: anonymous user (no auth)
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Mock error logger — track calls
vi.mock("@/lib/services/error-logger", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/error-logger")
  >("@/lib/services/error-logger");
  return {
    ...actual,
    logError: mockLogError,
    extractRequestMeta: vi.fn(() => ({
      ip: "1.2.3.4",
      userAgent: "test-agent",
    })),
  };
});

// Mock the scraper client — control Apify responses per test
vi.mock("@/lib/services/apify-scraper-client", () => ({
  scrapeLinkedinProfile: mockScrapeLinkedinProfile,
}));

// Mock fingerprint — deterministic hash per IP+UA
vi.mock("@/lib/services/apify-fingerprint", () => ({
  computeFingerprint: vi.fn((ip: string, _ua?: string | null) => `fp-${ip}`),
}));

// Mock rate limiter — default allows all, override per-test for rate limit test
vi.mock("@/lib/services/rate-limiter", () => ({
  scrapeRateLimiter: { check: mockRateLimitCheck },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────

import { POST } from "../route";
import { prisma } from "@/lib/db/client";

// Sample profile from fixtures (inline subset for test clarity)
const SAMPLE_PROFILE = {
  publicIdentifier: "williamhgates",
  headline: "Chair, Gates Foundation and Founder, Breakthrough Energy",
  firstName: "Bill",
  lastName: "Gates",
  about: "Chair of the Gates Foundation.",
  experience: [],
  education: [],
};

// ── Helpers ───────────────────────────────────────────────────────────

function makeRequest(
  url = "https://linkedin.com/in/williamhgates",
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/scrape-linkedin", {
    method: "POST",
    body: JSON.stringify({ url }),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "1.2.3.4",
      "user-agent": "test-agent",
      ...headers,
    },
  });
}

// ── Save/restore env + reset state ────────────────────────────────────

let originalApifyEnabled: string | undefined;

beforeEach(() => {
  (prisma as any).__test__.reset();
  mockLogError.mockClear();
  mockScrapeLinkedinProfile.mockReset();
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: null } });
  mockRateLimitCheck.mockReset();
  mockRateLimitCheck.mockReturnValue({ allowed: true });

  // Default: APIFY_ENABLED is "true" (most tests want it on)
  originalApifyEnabled = process.env.APIFY_ENABLED;
  process.env.APIFY_ENABLED = "true";
});

afterEach(() => {
  if (originalApifyEnabled !== undefined) {
    process.env.APIFY_ENABLED = originalApifyEnabled;
  } else {
    delete process.env.APIFY_ENABLED;
  }
});

// ── Tests ─────────────────────────────────────────────────────────────

describe("POST /api/scrape-linkedin", () => {
  // Test 1: Valid URL + fresh call + successful Apify returns 200
  it("returns 200 with profile data on successful fresh scrape", async () => {
    // Seed anon usage so quota check passes (first scrape)
    mockScrapeLinkedinProfile.mockResolvedValue({
      runId: "run-1",
      items: [SAMPLE_PROFILE],
      costUsd: 0.004,
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile).toBeDefined();
    expect(body.profile.headline).toBe(SAMPLE_PROFILE.headline);
    expect(body.cached).toBe(false);
    expect(body.quotaRemaining).toBeDefined();
    expect(body.plan).toBeDefined();
    expect(body.source).toBe("apify");
  });

  // Test 2: Valid URL + cache hit returns 200 + cached:true + no Apify call
  it("returns cached data without calling Apify when cache is fresh", async () => {
    // Pre-seed cache
    const normalizedUrl = "https://linkedin.com/in/williamhgates";
    (prisma as any).__test__.seedCache({
      url: normalizedUrl,
      urlHash: "testhash",
      profileData: SAMPLE_PROFILE,
      scrapedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000), // 24h from now
      apifyRunId: "run-cached",
      costUsd: 0.004,
      id: "cache-1",
    });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(body.profile.headline).toBe(SAMPLE_PROFILE.headline);
    expect(body.source).toBe("apify");
    // Apify client should NOT have been called
    expect(mockScrapeLinkedinProfile).not.toHaveBeenCalled();
  });

  // Test 3: Invalid URL (non-linkedin host) returns 400
  it("returns 400 APIFY_INVALID_URL for non-linkedin host", async () => {
    const res = await POST(makeRequest("https://evil.com/in/test"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("APIFY_INVALID_URL");
  });

  // Test 4: Invalid URL (data: URI) returns 400
  it("returns 400 APIFY_INVALID_URL for data: URI", async () => {
    const res = await POST(
      makeRequest("data:text/html,<script>alert(1)</script>"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("APIFY_INVALID_URL");
  });

  // Test 5: APIFY_ENABLED=false returns 503
  it("returns 503 APIFY_DISABLED when APIFY_ENABLED is not true", async () => {
    process.env.APIFY_ENABLED = "false";

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("APIFY_DISABLED");
  });

  // Test 6: Rate limit exceeded returns 429
  it("returns 429 APIFY_RATE_LIMITED after exceeding rate limit", async () => {
    // Override rate limiter mock to simulate exceeded state
    mockRateLimitCheck.mockReturnValue({ allowed: false, retryAfter: 45 });

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toBe("APIFY_RATE_LIMITED");
    expect(body.retryAfter).toBe(45);
  });

  // Test 7: Anonymous user hits free quota returns 402
  it("returns 402 APIFY_QUOTA_EXCEEDED for anonymous user after quota used", async () => {
    // Pre-seed anonymous usage to simulate already used quota.
    // extractRequestMeta is mocked to always return ip "1.2.3.4",
    // so fingerprint mock produces "fp-1.2.3.4".
    const anonStore = (prisma as any).__test__.anonStore as Map<string, any>;
    anonStore.set("fp-1.2.3.4", {
      id: "anon-1",
      fingerprintHash: "fp-1.2.3.4",
      scrapeCount: 1, // already used 1 (max for free)
      firstScrapeAt: new Date(),
      lastScrapeAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(
      makeRequest("https://linkedin.com/in/quotatestuser"),
    );
    const body = await res.json();

    expect(res.status).toBe(402);
    expect(body.error).toBe("APIFY_QUOTA_EXCEEDED");
  });

  // Test 8: Apify returns empty items -> 422 APIFY_PROFILE_PRIVATE
  it("returns 422 APIFY_PROFILE_PRIVATE when Apify returns empty items", async () => {
    mockScrapeLinkedinProfile.mockRejectedValue(
      new Error("APIFY_PROFILE_PRIVATE"),
    );

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe("APIFY_PROFILE_PRIVATE");
  });

  // Test 9: Apify run status FAILED -> 500 APIFY_SCRAPE_FAILED
  it("returns 500 APIFY_SCRAPE_FAILED when Apify run fails", async () => {
    mockScrapeLinkedinProfile.mockRejectedValue(new Error("APIFY_RUN_FAILED"));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("APIFY_SCRAPE_FAILED");
  });

  // Test 10: Circuit breaker OPEN -> 503 APIFY_CIRCUIT_OPEN
  it("returns 503 APIFY_CIRCUIT_OPEN when circuit breaker is open", async () => {
    mockScrapeLinkedinProfile.mockRejectedValue(
      new Error("APIFY_CIRCUIT_OPEN"),
    );

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("APIFY_CIRCUIT_OPEN");
  });

  // Test 11: APIFY_API_TOKEN missing -> 503 APIFY_DISABLED
  it("returns 503 APIFY_DISABLED when APIFY_API_TOKEN is missing", async () => {
    mockScrapeLinkedinProfile.mockRejectedValue(
      new Error("APIFY_TOKEN_MISSING"),
    );

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("APIFY_DISABLED");
  });

  // Test 12: Every error branch calls logError
  it("calls logError on error paths", async () => {
    mockScrapeLinkedinProfile.mockRejectedValue(
      new Error("APIFY_SCRAPE_FAILED"),
    );

    await POST(makeRequest());

    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "api/scrape-linkedin",
        level: "error",
      }),
    );
  });

  // Test 13: Every request results in logUsage call (finally block)
  it("calls logUsage for every request (success or error)", async () => {
    const logSpy = vi.spyOn(
      await import("@/lib/services/apify-quota"),
      "logUsage",
    );

    // Successful request
    mockScrapeLinkedinProfile.mockResolvedValue({
      runId: "run-log",
      items: [SAMPLE_PROFILE],
      costUsd: 0.004,
    });

    await POST(makeRequest("https://linkedin.com/in/logtest"));

    // Wait for any microtask (logUsage is void-called)
    await new Promise((r) => setTimeout(r, 10));

    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  // Test 14: Authenticated paid user succeeds unconditionally after cache miss
  it("allows authenticated paid user (quota=null) to scrape without quota limits", async () => {
    // Seed a paid user
    (prisma as any).__test__.seedUser({
      id: "user-paid-1",
      email: "paid@test.com",
      apifyScrapeQuota: null, // unlimited
      apifyScrapeCount: 50, // already used many
      activePlanId: "starter",
    });

    // Override auth to return this user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-paid-1" } },
    });

    mockScrapeLinkedinProfile.mockResolvedValue({
      runId: "run-paid",
      items: [SAMPLE_PROFILE],
      costUsd: 0.004,
    });

    const res = await POST(makeRequest("https://linkedin.com/in/paidtest"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile).toBeDefined();
    expect(body.cached).toBe(false);
    expect(body.plan).toBe("starter");
    // quotaRemaining should be null for paid users
    expect(body.quotaRemaining).toBeNull();
  });
});
