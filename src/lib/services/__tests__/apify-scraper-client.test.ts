/**
 * Tests for apify-scraper-client.ts
 *
 * All 12 behaviors from Plan 01-04:
 * 1. Successful scrape returns {runId, items, costUsd}
 * 2. costUsd uses run.usageTotalUsd when present
 * 3. costUsd falls back to APIFY_COST_PER_SCRAPE (0.004) when undefined
 * 4. Empty items throws APIFY_PROFILE_PRIVATE
 * 5. FAILED status throws APIFY_RUN_FAILED
 * 6. TIMED-OUT status throws APIFY_RUN_TIMED-OUT + records transient failure
 * 7. Circuit breaker opens; next call throws APIFY_CIRCUIT_OPEN without calling Apify
 * 8. Missing APIFY_API_TOKEN throws APIFY_TOKEN_MISSING
 * 9. Every failure logs via logError with source + code
 * 10. APIFY_ACTOR_ID exported as "harvestapi/linkedin-profile-scraper"
 * 11. APIFY_COST_PER_SCRAPE exported as 0.004
 * 12. Items validated against harvestProfileSchema
 */
import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// Mock apify-client before any imports
const mockListItems = vi.fn();
const mockDataset = vi.fn().mockReturnValue({ listItems: mockListItems });
const mockCall = vi.fn();
const mockActor = vi.fn().mockReturnValue({ call: mockCall });

vi.mock("apify-client", () => ({
  ApifyClient: vi.fn().mockImplementation(() => ({
    actor: mockActor,
    dataset: mockDataset,
  })),
}));

vi.mock("@/lib/services/error-logger", () => ({
  logError: vi.fn(),
  extractRequestMeta: vi.fn(),
}));

// Import after mocks
import { logError } from "@/lib/services/error-logger";
import { apifyCircuitBreaker } from "@/lib/services/circuit-breaker";
import sampleProfile from "./fixtures/apify-profile-sample.json";

// Helper to get a clean profile item (without the _note metadata)
function getSampleItem() {
  const item = { ...sampleProfile[0] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (item as any)._note;
  return item;
}

// Shared run result for successful runs
function makeSucceededRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-abc-123",
    status: "SUCCEEDED",
    defaultDatasetId: "dataset-xyz",
    usageTotalUsd: 0.0038,
    ...overrides,
  };
}

describe("apify-scraper-client", () => {
  let scrapeLinkedinProfile: typeof import("@/lib/services/apify-scraper-client").scrapeLinkedinProfile;
  let APIFY_ACTOR_ID: string;
  let APIFY_COST_PER_SCRAPE: number;

  beforeEach(async () => {
    // Set env token
    process.env.APIFY_API_TOKEN = "apify_api_test_token_1234567890abcdefghij";
    vi.clearAllMocks();

    // Reset circuit breaker state by recording enough successes to close it
    // Use direct property manipulation for test isolation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breaker = apifyCircuitBreaker as any;
    breaker.state = "CLOSED";
    breaker.records = [];
    breaker.halfOpenSuccessStreak = 0;
    breaker.openedAt = 0;

    // Re-import to get fresh module
    const mod = await import("@/lib/services/apify-scraper-client");
    scrapeLinkedinProfile = mod.scrapeLinkedinProfile;
    APIFY_ACTOR_ID = mod.APIFY_ACTOR_ID;
    APIFY_COST_PER_SCRAPE = mod.APIFY_COST_PER_SCRAPE;

    // Default mock setup for success path
    mockCall.mockResolvedValue(makeSucceededRun());
    mockListItems.mockResolvedValue({ items: [getSampleItem()] });
  });

  // Test 1: Successful scrape returns {runId, items, costUsd}
  it("returns runId, items, and costUsd on successful scrape", async () => {
    const result = await scrapeLinkedinProfile({
      profileUrl: "https://www.linkedin.com/in/williamhgates",
      requestId: "req-001",
    });

    expect(result.runId).toBe("run-abc-123");
    expect(result.items).toHaveLength(1);
    expect(result.costUsd).toBeTypeOf("number");
    expect(result.costUsd).toBeGreaterThan(0);
  });

  // Test 2: costUsd uses run.usageTotalUsd when present
  it("uses run.usageTotalUsd for costUsd when available", async () => {
    mockCall.mockResolvedValue(makeSucceededRun({ usageTotalUsd: 0.0052 }));

    const result = await scrapeLinkedinProfile({
      profileUrl: "https://www.linkedin.com/in/testuser",
      requestId: "req-002",
    });

    expect(result.costUsd).toBe(0.0052);
  });

  // Test 3: costUsd falls back to APIFY_COST_PER_SCRAPE (0.004)
  it("falls back to APIFY_COST_PER_SCRAPE when usageTotalUsd is undefined", async () => {
    mockCall.mockResolvedValue(makeSucceededRun({ usageTotalUsd: undefined }));

    const result = await scrapeLinkedinProfile({
      profileUrl: "https://www.linkedin.com/in/testuser",
      requestId: "req-003",
    });

    expect(result.costUsd).toBe(0.004);
  });

  // Test 4: Empty items throws APIFY_PROFILE_PRIVATE
  it("throws APIFY_PROFILE_PRIVATE when items array is empty", async () => {
    mockCall.mockResolvedValue(makeSucceededRun());
    mockListItems.mockResolvedValue({ items: [] });

    await expect(
      scrapeLinkedinProfile({
        profileUrl: "https://www.linkedin.com/in/private-user",
        requestId: "req-004",
      }),
    ).rejects.toThrow("APIFY_PROFILE_PRIVATE");
  });

  // Test 5: FAILED status throws APIFY_RUN_FAILED
  it("throws error containing APIFY_RUN_FAILED when run status is FAILED", async () => {
    mockCall.mockResolvedValue({
      id: "run-fail-1",
      status: "FAILED",
      defaultDatasetId: "ds-fail",
    });

    await expect(
      scrapeLinkedinProfile({
        profileUrl: "https://www.linkedin.com/in/testuser",
        requestId: "req-005",
      }),
    ).rejects.toThrow("APIFY_RUN_FAILED");
  });

  // Test 6: TIMED-OUT status throws APIFY_RUN_TIMED-OUT and records transient failure
  it("throws APIFY_RUN_TIMED-OUT and records transient failure on breaker", async () => {
    mockCall.mockResolvedValue({
      id: "run-timeout-1",
      status: "TIMED-OUT",
      defaultDatasetId: "ds-timeout",
    });

    const recordFailureSpy = vi.spyOn(apifyCircuitBreaker, "recordFailure");

    await expect(
      scrapeLinkedinProfile({
        profileUrl: "https://www.linkedin.com/in/testuser",
        requestId: "req-006",
      }),
    ).rejects.toThrow("APIFY_RUN_TIMED-OUT");

    // Should record as transient failure (true)
    expect(recordFailureSpy).toHaveBeenCalledWith(true);
    recordFailureSpy.mockRestore();
  });

  // Test 7: Circuit breaker opens; next call throws APIFY_CIRCUIT_OPEN
  it("throws APIFY_CIRCUIT_OPEN when circuit breaker is open, without calling ApifyClient", async () => {
    // Force breaker to OPEN state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const breaker = apifyCircuitBreaker as any;
    breaker.state = "OPEN";
    breaker.openedAt = Date.now(); // just opened, won't transition to HALF_OPEN

    await expect(
      scrapeLinkedinProfile({
        profileUrl: "https://www.linkedin.com/in/testuser",
        requestId: "req-007",
      }),
    ).rejects.toThrow("APIFY_CIRCUIT_OPEN");

    // ApifyClient should NOT have been called
    expect(mockCall).not.toHaveBeenCalled();
  });

  // Test 8: Missing APIFY_API_TOKEN throws APIFY_TOKEN_MISSING
  it("throws APIFY_TOKEN_MISSING when APIFY_API_TOKEN is not set", async () => {
    delete process.env.APIFY_API_TOKEN;

    await expect(
      scrapeLinkedinProfile({
        profileUrl: "https://www.linkedin.com/in/testuser",
        requestId: "req-008",
      }),
    ).rejects.toThrow("APIFY_TOKEN_MISSING");
  });

  // Test 9: Every failure path calls logError with source and code
  it("calls logError with correct source and code on failure paths", async () => {
    // Test with FAILED run
    mockCall.mockResolvedValue({
      id: "run-fail-log",
      status: "FAILED",
      defaultDatasetId: "ds-fail",
    });

    try {
      await scrapeLinkedinProfile({
        profileUrl: "https://www.linkedin.com/in/testuser",
        requestId: "req-009",
      });
    } catch {
      // expected
    }

    const logCalls = (logError as Mock).mock.calls;
    expect(logCalls.length).toBeGreaterThanOrEqual(1);
    const lastCall = logCalls[logCalls.length - 1][0];
    expect(lastCall.source).toBe("services/apify-scraper-client");
    expect(lastCall.code).toBeDefined();
  });

  // Test 10: APIFY_ACTOR_ID exported as "harvestapi/linkedin-profile-scraper"
  it("exports APIFY_ACTOR_ID as harvestapi/linkedin-profile-scraper", () => {
    expect(APIFY_ACTOR_ID).toBe("harvestapi/linkedin-profile-scraper");
  });

  // Test 11: APIFY_COST_PER_SCRAPE exported as 0.004
  it("exports APIFY_COST_PER_SCRAPE as 0.004", () => {
    expect(APIFY_COST_PER_SCRAPE).toBe(0.004);
  });

  // Test 12: Items validated against harvestProfileSchema
  it("validates items against harvestProfileSchema (passthrough allows extra fields)", async () => {
    // Use the real sample fixture which has extra fields like _note, profilePicture, etc.
    const sampleItem = getSampleItem();
    mockCall.mockResolvedValue(makeSucceededRun());
    mockListItems.mockResolvedValue({ items: [sampleItem] });

    const result = await scrapeLinkedinProfile({
      profileUrl: "https://www.linkedin.com/in/williamhgates",
      requestId: "req-012",
    });

    // Should succeed and return items (passthrough preserves extra fields)
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toHaveProperty("headline");
  });
});
