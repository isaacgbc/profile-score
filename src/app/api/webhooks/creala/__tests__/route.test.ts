/**
 * Regression tests for POST /api/webhooks/creala
 *
 * Verifies:
 * 1. Plan 01-07 addition: apifyScrapeQuota reset to null on plan upgrade
 * 2. HMAC signature verification still rejects invalid signatures
 * 3. Pre-existing behavior: activePlanId + subscriptionStatus updated on successful webhook
 *
 * Strategy: mock Prisma at import boundary, compute real HMAC signatures
 * using a known test secret, call POST handler directly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

// ── Hoisted mocks ───────────────────────────────────────────────

const { mockOrderStore, mockUserStore } = vi.hoisted(() => ({
  mockOrderStore: new Map<string, any>(),
  mockUserStore: new Map<string, any>(),
}));

// Mock Prisma with order + user models
vi.mock("@/lib/db/client", () => ({
  prisma: {
    order: {
      findUnique: vi.fn(async ({ where }: any) => {
        return mockOrderStore.get(where.saleId) ?? null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: crypto.randomUUID(), ...data };
        mockOrderStore.set(data.saleId, row);
        return row;
      }),
    },
    user: {
      findFirst: vi.fn(async ({ where }: any) => {
        return mockUserStore.get(where.id) ?? null;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        // findUnique by email
        if (where.email) {
          for (const u of mockUserStore.values()) {
            if (u.email === where.email) return u;
          }
          return null;
        }
        return mockUserStore.get(where.id) ?? null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const existing = mockUserStore.get(where.id);
        if (!existing) throw new Error("User not found");
        const updated = { ...existing, ...data };
        mockUserStore.set(where.id, updated);
        return updated;
      }),
    },
  },
}));

// Mock analytics (fire-and-forget, not relevant to these tests)
vi.mock("@/lib/analytics/server-tracker", () => ({
  trackServerEvent: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { POST } from "../route";

// ── Test helpers ────────────────────────────────────────────────

const TEST_WEBHOOK_SECRET = "test-secret-for-hmac-verification";

async function computeHmac(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeWebhookPayload(overrides: Record<string, any> = {}) {
  return {
    event: "new_sale",
    timestamp: new Date().toISOString(),
    test: true,
    saleId: `sale_${Date.now()}`,
    product: {
      id: "prod_1",
      name: "ProfileScore Starter",
      price: 5,
      currency: "USD",
    },
    customer: {
      id: "user-creala-1",
      name: "Test User",
      email: "test@example.com",
      country: "US",
    },
    subscription: {
      id: undefined,
      interval: undefined,
      nextBillingDate: undefined,
      cancellationDate: undefined,
    },
    ...overrides,
  };
}

async function makeSignedRequest(
  payload: object,
  secret = TEST_WEBHOOK_SECRET,
): Promise<Request> {
  const body = JSON.stringify(payload);
  const signature = await computeHmac(body, secret);
  return new Request("http://localhost/api/webhooks/creala", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "x-webhook-signature": signature,
    },
  });
}

// ── Setup ───────────────────────────────────────────────────────

let originalSecret: string | undefined;

beforeEach(() => {
  mockOrderStore.clear();
  mockUserStore.clear();

  // Seed a test user that matches customer.id in our payload
  mockUserStore.set("user-creala-1", {
    id: "user-creala-1",
    email: "test@example.com",
    activePlanId: null,
    subscriptionStatus: null,
    subscriptionExpiresAt: null,
    apifyScrapeQuota: 1, // free tier: 1 scrape
    apifyScrapeCount: 0,
    apifyFirstScrapeAt: null,
  });

  // Set webhook secret for HMAC verification
  originalSecret = process.env.CREALA_WEBHOOK_SECRET;
  process.env.CREALA_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
});

afterEach(() => {
  if (originalSecret !== undefined) {
    process.env.CREALA_WEBHOOK_SECRET = originalSecret;
  } else {
    delete process.env.CREALA_WEBHOOK_SECRET;
  }
});

// ── Tests ───────────────────────────────────────────────────────

describe("POST /api/webhooks/creala", () => {
  // Test 1: apifyScrapeQuota reset to null on new_sale
  it("sets apifyScrapeQuota to null on new_sale plan upgrade", async () => {
    const payload = makeWebhookPayload({ event: "new_sale" });
    const req = await makeSignedRequest(payload);
    const res = await POST(req);

    expect(res.status).toBe(200);

    // Check user was updated with apifyScrapeQuota: null
    const user = mockUserStore.get("user-creala-1");
    expect(user).toBeDefined();
    expect(user.apifyScrapeQuota).toBeNull();
    expect(user.activePlanId).toBe("starter");
  });

  // Test 2: apifyScrapeQuota reset to null on new_subscription
  it("sets apifyScrapeQuota to null on new_subscription plan upgrade", async () => {
    const payload = makeWebhookPayload({
      event: "new_subscription",
      subscription: {
        id: "sub_1",
        interval: "monthly",
        nextBillingDate: "2026-05-12T00:00:00Z",
      },
    });
    const req = await makeSignedRequest(payload);
    const res = await POST(req);

    expect(res.status).toBe(200);

    const user = mockUserStore.get("user-creala-1");
    expect(user).toBeDefined();
    expect(user.apifyScrapeQuota).toBeNull();
    expect(user.subscriptionStatus).toBe("active");
  });

  // Test 3: HMAC regression — invalid signature returns 401
  it("rejects requests with invalid HMAC signature (regression guard)", async () => {
    const payload = makeWebhookPayload();
    const body = JSON.stringify(payload);
    const req = new Request("http://localhost/api/webhooks/creala", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "x-webhook-signature": "invalid_signature_that_should_be_rejected",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const resBody = await res.json();
    expect(resBody.error).toBe("Invalid signature");
  });

  // Test 4: Pre-existing behavior — activePlanId and subscriptionStatus updated
  it("updates activePlanId and subscriptionStatus on successful plan upgrade (regression guard)", async () => {
    const payload = makeWebhookPayload({
      event: "new_sale",
      product: {
        id: "prod_2",
        name: "ProfileScore Recommended",
        price: 10,
        currency: "USD",
      },
    });
    const req = await makeSignedRequest(payload);
    const res = await POST(req);

    expect(res.status).toBe(200);

    const user = mockUserStore.get("user-creala-1");
    expect(user.activePlanId).toBe("recommended");
    expect(user.subscriptionStatus).toBe("active");
    // Also verify quota reset happened alongside plan update
    expect(user.apifyScrapeQuota).toBeNull();
  });
});
