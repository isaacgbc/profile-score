/**
 * Tests for scrapeRateLimiter (from rate-limiter.ts).
 *
 * 5 behaviors from Plan 01-04 Task 3:
 * 1. First 3 calls with same key return {allowed: true}
 * 2. 4th call with same key returns {allowed: false, retryAfter: number}
 * 3. Different keys are independent (alice and bob each get 3 slots)
 * 4. After windowMs elapses, counter resets and allows 3 more
 * 5. retryAfter is a positive number in seconds
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock error-logger to prevent DB writes during tests
vi.mock("@/lib/services/error-logger", () => ({
  logError: vi.fn(),
  extractRequestMeta: vi.fn(),
}));

import { scrapeRateLimiter } from "@/lib/services/rate-limiter";

describe("scrapeRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Test 1: First 3 calls with same key return {allowed: true}
  it("allows the first 3 requests for the same key", () => {
    const key = `test-allow-3-${Math.random()}`;

    const r1 = scrapeRateLimiter.check(key);
    const r2 = scrapeRateLimiter.check(key);
    const r3 = scrapeRateLimiter.check(key);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
  });

  // Test 2: 4th call with same key returns {allowed: false, retryAfter: number}
  it("blocks the 4th request for the same key with retryAfter", () => {
    const key = `test-block-4th-${Math.random()}`;

    scrapeRateLimiter.check(key);
    scrapeRateLimiter.check(key);
    scrapeRateLimiter.check(key);
    const r4 = scrapeRateLimiter.check(key);

    expect(r4.allowed).toBe(false);
    expect(r4.retryAfter).toBeDefined();
    expect(typeof r4.retryAfter).toBe("number");
  });

  // Test 3: Different keys are independent
  it("tracks different keys independently (alice and bob each get 3 slots)", () => {
    const alice = `alice-${Math.random()}`;
    const bob = `bob-${Math.random()}`;

    // Alice uses 3
    expect(scrapeRateLimiter.check(alice).allowed).toBe(true);
    expect(scrapeRateLimiter.check(alice).allowed).toBe(true);
    expect(scrapeRateLimiter.check(alice).allowed).toBe(true);
    expect(scrapeRateLimiter.check(alice).allowed).toBe(false);

    // Bob should still have 3 slots
    expect(scrapeRateLimiter.check(bob).allowed).toBe(true);
    expect(scrapeRateLimiter.check(bob).allowed).toBe(true);
    expect(scrapeRateLimiter.check(bob).allowed).toBe(true);
    expect(scrapeRateLimiter.check(bob).allowed).toBe(false);
  });

  // Test 4: After windowMs elapses, counter resets and allows 3 more
  it("resets after windowMs (60s) and allows 3 more requests", () => {
    const key = `test-reset-${Math.random()}`;

    // Use all 3 slots
    scrapeRateLimiter.check(key);
    scrapeRateLimiter.check(key);
    scrapeRateLimiter.check(key);
    expect(scrapeRateLimiter.check(key).allowed).toBe(false);

    // Advance time past the 60s window
    vi.advanceTimersByTime(61_000);

    // Should allow 3 more
    expect(scrapeRateLimiter.check(key).allowed).toBe(true);
    expect(scrapeRateLimiter.check(key).allowed).toBe(true);
    expect(scrapeRateLimiter.check(key).allowed).toBe(true);
    expect(scrapeRateLimiter.check(key).allowed).toBe(false);
  });

  // Test 5: retryAfter is a positive number (in seconds)
  it("returns a positive retryAfter value in seconds when rate limited", () => {
    const key = `test-retry-${Math.random()}`;

    scrapeRateLimiter.check(key);
    scrapeRateLimiter.check(key);
    scrapeRateLimiter.check(key);
    const result = scrapeRateLimiter.check(key);

    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
    // retryAfter should be in seconds (windowMs / 1000 = 60 max)
    expect(result.retryAfter).toBeLessThanOrEqual(60);
  });
});
