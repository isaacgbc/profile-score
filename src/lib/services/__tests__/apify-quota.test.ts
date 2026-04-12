/**
 * Tests for apify-quota.ts
 *
 * Covers all 3 tiers (paid/free-authed/free-anon), cache-hit bypass,
 * and append-only usage logging.
 *
 * @see 01-06-PLAN.md — 22 behaviors
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", () => import("@/lib/db/__mocks__/client"));

import { prisma } from "@/lib/db/client";
import {
  checkQuota,
  consumeQuota,
  getQuotaState,
  logUsage,
  APIFY_FREE_QUOTA,
} from "@/lib/services/apify-quota";

// Type-cast for __test__ helpers
const mock = (prisma as any).__test__;

beforeEach(() => {
  mock.reset();
  vi.clearAllMocks();
});

// ── checkQuota ──────────────────────────────────────────────

describe("checkQuota", () => {
  // Test 1: cache hit short-circuits (no DB lookups)
  it("Test 1: isCacheHit = true returns immediately without DB lookups", async () => {
    await checkQuota({
      userId: "u1",
      fingerprintHash: "fp1",
      isCacheHit: true,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.anonymousApifyUsage.findUnique).not.toHaveBeenCalled();
  });

  // Test 2: paid user (apifyScrapeQuota = null) returns silently
  it("Test 2: userId present, apifyScrapeQuota = null (paid) returns silently", async () => {
    mock.seedUser({
      id: "paid-user",
      email: "paid@test.com",
      apifyScrapeQuota: null,
      apifyScrapeCount: 999,
      activePlanId: "starter",
    });
    await expect(
      checkQuota({ userId: "paid-user", isCacheHit: false }),
    ).resolves.toBeUndefined();
  });

  // Test 3: apifyScrapeQuota = 0, apifyScrapeCount = 0 -> throws
  it("Test 3: userId present, apifyScrapeQuota = 0, apifyScrapeCount = 0 throws APIFY_QUOTA_EXCEEDED", async () => {
    mock.seedUser({
      id: "zero-quota",
      email: "zero@test.com",
      apifyScrapeQuota: 0,
      apifyScrapeCount: 0,
    });
    await expect(
      checkQuota({ userId: "zero-quota", isCacheHit: false }),
    ).rejects.toThrow("APIFY_QUOTA_EXCEEDED");
  });

  // Test 4: apifyScrapeQuota = 1, apifyScrapeCount = 0 -> returns silently
  it("Test 4: userId present, apifyScrapeQuota = 1, apifyScrapeCount = 0 returns silently", async () => {
    mock.seedUser({
      id: "free-fresh",
      email: "fresh@test.com",
      apifyScrapeQuota: 1,
      apifyScrapeCount: 0,
    });
    await expect(
      checkQuota({ userId: "free-fresh", isCacheHit: false }),
    ).resolves.toBeUndefined();
  });

  // Test 5: apifyScrapeQuota = 1, apifyScrapeCount = 1 -> throws
  it("Test 5: userId present, apifyScrapeQuota = 1, apifyScrapeCount = 1 throws APIFY_QUOTA_EXCEEDED", async () => {
    mock.seedUser({
      id: "free-used",
      email: "used@test.com",
      apifyScrapeQuota: 1,
      apifyScrapeCount: 1,
    });
    await expect(
      checkQuota({ userId: "free-used", isCacheHit: false }),
    ).rejects.toThrow("APIFY_QUOTA_EXCEEDED");
  });

  // Test 6: user not found -> throws
  it("Test 6: userId present but user not found throws APIFY_QUOTA_EXCEEDED", async () => {
    await expect(
      checkQuota({ userId: "nonexistent", isCacheHit: false }),
    ).rejects.toThrow("APIFY_QUOTA_EXCEEDED");
  });

  // Test 7: anon, no existing record -> returns silently
  it("Test 7: no userId, fingerprintHash present, no anon record returns silently", async () => {
    await expect(
      checkQuota({ fingerprintHash: "new-fp", isCacheHit: false }),
    ).resolves.toBeUndefined();
  });

  // Test 8: anon, existing record with scrapeCount = 1 -> throws
  it("Test 8: no userId, fingerprintHash present, anon scrapeCount = 1 throws APIFY_QUOTA_EXCEEDED", async () => {
    mock.anonStore.set("used-fp", {
      id: "a1",
      fingerprintHash: "used-fp",
      scrapeCount: 1,
      firstScrapeAt: new Date(),
      lastScrapeAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await expect(
      checkQuota({ fingerprintHash: "used-fp", isCacheHit: false }),
    ).rejects.toThrow("APIFY_QUOTA_EXCEEDED");
  });

  // Test 9: both userId and fingerprintHash missing -> throws
  it("Test 9: both userId and fingerprintHash missing throws APIFY_QUOTA_EXCEEDED", async () => {
    await expect(checkQuota({ isCacheHit: false })).rejects.toThrow(
      "APIFY_QUOTA_EXCEEDED",
    );
  });

  // Test 10: paid takes precedence even with high scrapeCount
  it("Test 10: apifyScrapeQuota = null (paid) returns silently even with high apifyScrapeCount", async () => {
    mock.seedUser({
      id: "heavy-paid",
      email: "heavy@test.com",
      apifyScrapeQuota: null,
      apifyScrapeCount: 10000,
      activePlanId: "recommended",
    });
    await expect(
      checkQuota({ userId: "heavy-paid", isCacheHit: false }),
    ).resolves.toBeUndefined();
  });
});

// ── consumeQuota ────────────────────────────────────────────

describe("consumeQuota", () => {
  // Test 11: with userId, increments apifyScrapeCount and sets apifyFirstScrapeAt if null
  it("Test 11: userId increments apifyScrapeCount and sets apifyFirstScrapeAt if null", async () => {
    mock.seedUser({
      id: "u-consume",
      email: "consume@test.com",
      apifyScrapeQuota: 1,
      apifyScrapeCount: 0,
      apifyFirstScrapeAt: null,
    });
    await consumeQuota({ userId: "u-consume" });
    const user = mock.userStore.get("u-consume");
    expect(user.apifyScrapeCount).toBe(1);
    expect(user.apifyFirstScrapeAt).toBeInstanceOf(Date);
  });

  // Test 12: with userId, does NOT overwrite apifyFirstScrapeAt if already set
  it("Test 12: userId does NOT overwrite apifyFirstScrapeAt if already set", async () => {
    const originalDate = new Date("2025-01-01T00:00:00Z");
    mock.seedUser({
      id: "u-existing",
      email: "existing@test.com",
      apifyScrapeQuota: null,
      apifyScrapeCount: 5,
      apifyFirstScrapeAt: originalDate,
    });
    await consumeQuota({ userId: "u-existing" });
    const user = mock.userStore.get("u-existing");
    expect(user.apifyScrapeCount).toBe(6);
    expect(user.apifyFirstScrapeAt).toEqual(originalDate);
  });

  // Test 13: with fingerprintHash only, upserts AnonymousApifyUsage
  it("Test 13: fingerprintHash upserts AnonymousApifyUsage with scrapeCount += 1", async () => {
    // Seed existing anon record
    mock.anonStore.set("fp-existing", {
      id: "a1",
      fingerprintHash: "fp-existing",
      scrapeCount: 1,
      firstScrapeAt: new Date("2025-01-01"),
      lastScrapeAt: new Date("2025-01-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await consumeQuota({ fingerprintHash: "fp-existing" });
    const row = mock.anonStore.get("fp-existing");
    expect(row.scrapeCount).toBe(2);
    expect(row.lastScrapeAt).toBeInstanceOf(Date);
  });

  // Test 14: first anon call creates record with scrapeCount = 1
  it("Test 14: first anon call creates record with scrapeCount = 1 and firstScrapeAt = now", async () => {
    await consumeQuota({ fingerprintHash: "fp-new" });
    const row = mock.anonStore.get("fp-new");
    expect(row).toBeDefined();
    expect(row.scrapeCount).toBe(1);
    expect(row.firstScrapeAt).toBeInstanceOf(Date);
  });
});

// ── getQuotaState ───────────────────────────────────────────

describe("getQuotaState", () => {
  // Test 15: paid user returns { remaining: null, plan based on activePlanId }
  it("Test 15: paid user (quota = null) returns { remaining: null, plan: 'starter' }", async () => {
    mock.seedUser({
      id: "paid-state",
      email: "paid-state@test.com",
      apifyScrapeQuota: null,
      apifyScrapeCount: 50,
      activePlanId: "starter",
    });
    const state = await getQuotaState({ userId: "paid-state" });
    expect(state).toEqual({ remaining: null, plan: "starter" });
  });

  // Test 16: free user with quota=1, count=0 returns { remaining: 1, plan: "free" }
  it("Test 16: free user quota=1, count=0 returns { remaining: 1, plan: 'free' }", async () => {
    mock.seedUser({
      id: "free-state",
      email: "free-state@test.com",
      apifyScrapeQuota: 1,
      apifyScrapeCount: 0,
    });
    const state = await getQuotaState({ userId: "free-state" });
    expect(state).toEqual({ remaining: 1, plan: "free" });
  });

  // Test 17: free user with quota=1, count=1 returns { remaining: 0, plan: "free" }
  it("Test 17: free user quota=1, count=1 returns { remaining: 0, plan: 'free' }", async () => {
    mock.seedUser({
      id: "free-used-state",
      email: "free-used-state@test.com",
      apifyScrapeQuota: 1,
      apifyScrapeCount: 1,
    });
    const state = await getQuotaState({ userId: "free-used-state" });
    expect(state).toEqual({ remaining: 0, plan: "free" });
  });

  // Test 18: anonymous with no record returns { remaining: APIFY_FREE_QUOTA, plan: "free" }
  it("Test 18: anonymous with no record returns { remaining: 1, plan: 'free' }", async () => {
    const state = await getQuotaState({ fingerprintHash: "anon-new" });
    expect(state).toEqual({ remaining: APIFY_FREE_QUOTA, plan: "free" });
  });

  // Test 19: anonymous with scrapeCount=1 returns { remaining: 0, plan: "free" }
  it("Test 19: anonymous with scrapeCount=1 returns { remaining: 0, plan: 'free' }", async () => {
    mock.anonStore.set("anon-used", {
      id: "a1",
      fingerprintHash: "anon-used",
      scrapeCount: 1,
      firstScrapeAt: new Date(),
      lastScrapeAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const state = await getQuotaState({ fingerprintHash: "anon-used" });
    expect(state).toEqual({ remaining: 0, plan: "free" });
  });

  // Test 20: missing both userId and fingerprintHash returns { remaining: 0, plan: "free" }
  it("Test 20: missing both returns { remaining: 0, plan: 'free' }", async () => {
    const state = await getQuotaState({});
    expect(state).toEqual({ remaining: 0, plan: "free" });
  });
});

// ── logUsage ────────────────────────────────────────────────

describe("logUsage", () => {
  // Test 21: calls prisma.apifyUsageLog.create with all provided fields
  it("Test 21: creates log entry with all fields", async () => {
    await logUsage({
      userId: "u1",
      fingerprintHash: "fp1",
      url: "https://linkedin.com/in/test",
      urlHash: "abc123",
      cacheHit: false,
      apifyRunId: "run-1",
      costUsd: 0.004,
      success: true,
      errorCode: null,
      durationMs: 3500,
    });
    expect(prisma.apifyUsageLog.create).toHaveBeenCalledTimes(1);
    const call = (prisma.apifyUsageLog.create as any).mock.calls[0][0];
    expect(call.data).toMatchObject({
      userId: "u1",
      fingerprintHash: "fp1",
      url: "https://linkedin.com/in/test",
      urlHash: "abc123",
      cacheHit: false,
      apifyRunId: "run-1",
      costUsd: 0.004,
      success: true,
      errorCode: null,
      durationMs: 3500,
    });
  });

  // Test 22: nullable fields (apifyRunId, errorCode, durationMs) can be omitted
  it("Test 22: nullable fields can be omitted", async () => {
    await logUsage({
      url: "https://linkedin.com/in/test",
      urlHash: "abc123",
      cacheHit: true,
      costUsd: 0,
      success: true,
    });
    expect(prisma.apifyUsageLog.create).toHaveBeenCalledTimes(1);
    const call = (prisma.apifyUsageLog.create as any).mock.calls[0][0];
    expect(call.data.apifyRunId).toBeNull();
    expect(call.data.errorCode).toBeNull();
    expect(call.data.durationMs).toBeNull();
    expect(call.data.userId).toBeNull();
    expect(call.data.fingerprintHash).toBeNull();
  });
});
