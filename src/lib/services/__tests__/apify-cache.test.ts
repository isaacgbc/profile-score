import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/db/client", () => import("@/lib/db/__mocks__/client"));

import { prisma } from "@/lib/db/client";
import {
  normalizeLinkedinUrl,
  hashUrl,
  readCache,
  writeCache,
  APIFY_CACHE_TTL_MS,
} from "../apify-cache";

describe("normalizeLinkedinUrl", () => {
  it("returns canonical form for a simple linkedin.com/in/ URL", () => {
    expect(normalizeLinkedinUrl("https://linkedin.com/in/john")).toBe(
      "https://linkedin.com/in/john",
    );
  });

  it("strips www, lowercases slug, and strips trailing slash", () => {
    expect(normalizeLinkedinUrl("https://www.linkedin.com/in/John/")).toBe(
      "https://linkedin.com/in/john",
    );
  });

  it("strips country TLD subdomain (es.linkedin.com)", () => {
    expect(normalizeLinkedinUrl("https://es.linkedin.com/in/maria")).toBe(
      "https://linkedin.com/in/maria",
    );
  });

  it("strips mobile prefix (m.linkedin.com)", () => {
    expect(normalizeLinkedinUrl("https://m.linkedin.com/in/pablo")).toBe(
      "https://linkedin.com/in/pablo",
    );
  });

  it("strips query parameters", () => {
    expect(
      normalizeLinkedinUrl("https://linkedin.com/in/sofia?trk=pub-profile"),
    ).toBe("https://linkedin.com/in/sofia");
  });

  it("strips sub-routes after the slug", () => {
    expect(
      normalizeLinkedinUrl("https://linkedin.com/in/julia/details/experience"),
    ).toBe("https://linkedin.com/in/julia");
  });

  it("throws APIFY_INVALID_URL for non-linkedin hosts", () => {
    expect(() =>
      normalizeLinkedinUrl("https://google.com/in/foo"),
    ).toThrowError("APIFY_INVALID_URL");
  });

  it("throws APIFY_INVALID_URL for invalid URLs", () => {
    expect(() => normalizeLinkedinUrl("not a url")).toThrowError(
      "APIFY_INVALID_URL",
    );
  });

  it("throws APIFY_INVALID_URL for non-/in/ paths (company pages)", () => {
    expect(() =>
      normalizeLinkedinUrl("https://linkedin.com/company/foo"),
    ).toThrowError("APIFY_INVALID_URL");
  });
});

describe("hashUrl", () => {
  it("returns a 64-char lowercase hex string", () => {
    const result = hashUrl("x");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic and collision-resistant", () => {
    const a = hashUrl("https://linkedin.com/in/alice");
    const b = hashUrl("https://linkedin.com/in/alice");
    const c = hashUrl("https://linkedin.com/in/bob");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("readCache", () => {
  beforeEach(() => {
    (prisma as any).__test__.reset();
  });

  it("returns null when no entry exists", async () => {
    const result = await readCache("https://linkedin.com/in/nobody");
    expect(result).toBeNull();
  });

  it("returns null when entry exists but TTL has expired", async () => {
    const expired = new Date(Date.now() - 1000); // 1 second in the past
    (prisma as any).__test__.seedCache({
      id: "cache-1",
      url: "https://linkedin.com/in/expired",
      urlHash: hashUrl("https://linkedin.com/in/expired"),
      profileData: { headline: "Old data" },
      scrapedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      expiresAt: expired,
      apifyRunId: "run-1",
      costUsd: 0.004,
    });

    const result = await readCache("https://linkedin.com/in/expired");
    expect(result).toBeNull();
  });

  it("returns cached profileData when entry is fresh", async () => {
    const fresh = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h from now
    const profileData = { headline: "Fresh data", about: "Active profile" };
    (prisma as any).__test__.seedCache({
      id: "cache-2",
      url: "https://linkedin.com/in/fresh",
      urlHash: hashUrl("https://linkedin.com/in/fresh"),
      profileData,
      scrapedAt: new Date(),
      expiresAt: fresh,
      apifyRunId: "run-2",
      costUsd: 0.004,
    });

    const result = await readCache("https://linkedin.com/in/fresh");
    expect(result).toEqual(profileData);
  });
});

describe("writeCache", () => {
  beforeEach(() => {
    (prisma as any).__test__.reset();
    vi.clearAllMocks();
  });

  it("calls prisma.linkedInProfileCache.upsert with correct fields including expiresAt = now + 24h", async () => {
    const profileData = { headline: "Test Profile" };
    const beforeWrite = Date.now();

    await writeCache({
      normalizedUrl: "https://linkedin.com/in/test",
      profileData,
      apifyRunId: "run-3",
      costUsd: 0.004,
    });

    const afterWrite = Date.now();

    expect(prisma.linkedInProfileCache.upsert).toHaveBeenCalledTimes(1);
    const call = vi.mocked(prisma.linkedInProfileCache.upsert).mock.calls[0][0];

    // Check where clause
    expect(call.where.url).toBe("https://linkedin.com/in/test");

    // Check create data
    expect(call.create.url).toBe("https://linkedin.com/in/test");
    expect(call.create.urlHash).toBe(hashUrl("https://linkedin.com/in/test"));
    expect(call.create.profileData).toBe(profileData);
    expect(call.create.apifyRunId).toBe("run-3");

    // Check expiresAt is ~24h from now
    const expiresAt = call.create.expiresAt.getTime();
    const expectedMin = beforeWrite + APIFY_CACHE_TTL_MS;
    const expectedMax = afterWrite + APIFY_CACHE_TTL_MS;
    expect(expiresAt).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt).toBeLessThanOrEqual(expectedMax);
  });
});

describe("APIFY_CACHE_TTL_MS", () => {
  it("equals 24 hours in milliseconds", () => {
    expect(APIFY_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
