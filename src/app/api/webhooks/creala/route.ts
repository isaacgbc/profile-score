import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { trackServerEvent } from "@/lib/analytics/server-tracker";
import type { Prisma } from "@prisma/client";

// ── Crea.la event types ──────────────────────────────────
type CrealaEvent =
  | "new_sale"
  | "new_subscription"
  | "subscription_renewal"
  | "subscription_cancellation"
  | "payment_failed";

// ── Webhook payload shape (from Crea.la docs) ────────────
interface CrealaWebhookPayload {
  event: CrealaEvent;
  timestamp: string;
  test: boolean;
  saleId: string;
  product: {
    id: string;
    name: string;
    price: number;
    currency: string;
  };
  customer: {
    id: string;
    name: string;
    email: string;
    country: string;
  };
  subscription: {
    id?: string;
    interval?: string;
    nextBillingDate?: string;
    cancellationDate?: string;
  };
}

// ── Map Crea.la product names → internal planIds ─────────
const PRODUCT_TO_PLAN: Record<string, string> = {
  "ProfileScore Starter": "starter",
  "ProfileScore Recommended": "recommended",
  // Legacy mappings for any in-flight old orders
  "ProfileScore Pro": "recommended",
  "ProfileScore Coach": "recommended",
};

function resolvePlanId(productName: string, price: number): string | null {
  // First try exact product name mapping
  if (PRODUCT_TO_PLAN[productName]) return PRODUCT_TO_PLAN[productName];

  // Fallback: match by price (2-plan structure: $5 starter, $10 recommended)
  if (price <= 5) return "starter";
  if (price <= 10) return "recommended";

  // Legacy prices map to recommended
  if (price <= 50) return "recommended";

  return null;
}

// ── Map Crea.la event → our analytics event name ─────────
const EVENT_TO_ANALYTICS: Record<CrealaEvent, string> = {
  new_sale: "payment_success",
  new_subscription: "payment_success",
  subscription_renewal: "payment_success",
  subscription_cancellation: "subscription_canceled",
  payment_failed: "payment_failed",
};

// ── HMAC SHA-256 signature verification ──────────────────
// Per Crea.la docs: HMAC-SHA256(webhookSecret, rawRequestBody)
// Note: Each product has its own webhook secret (not the "General" one).
async function verifySignature(
  rawBody: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Normalize: some providers prefix with "sha256=" or "v1="
  const cleanSig = signature.replace(/^(sha256=|v1=)/, "");

  if (computed.length !== cleanSig.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ cleanSig.charCodeAt(i);
  }
  return diff === 0;
}

// ── Webhook handler ──────────────────────────────────────
export async function POST(request: Request) {
  const webhookSecret = process.env.CREALA_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret === "whsec_REPLACE_WITH_YOUR_CREALA_SECRET") {
    console.error("[Creala] CREALA_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  // ── Read raw body for signature verification ──
  const rawBody = await request.text();

  // ── Verify HMAC signature ──
  const signature = request.headers.get("x-webhook-signature") ?? "";
  if (!signature) {
    console.error("[Creala] Missing X-Webhook-Signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const valid = await verifySignature(rawBody, signature, webhookSecret);
  if (!valid) {
    console.error("[Creala] Invalid webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Parse payload ──
  let payload: CrealaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[Creala] Failed to parse JSON body:", rawBody.slice(0, 300));
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event, saleId, product, customer, subscription, test: isTest } = payload;

  // Validate required fields
  if (!event || !product || !customer) {
    console.error("[Creala] Missing required fields in payload");
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // payment_failed events may have empty saleId — generate a synthetic one
  const effectiveSaleId = saleId || `synthetic_${event}_${Date.now()}`;

  // ── Idempotency: check if saleId already processed ──
  if (saleId) {
    const existing = await prisma.order.findUnique({
      where: { saleId: effectiveSaleId },
    });
    if (existing) {
      console.log(`[Creala] Duplicate webhook ignored: saleId=${effectiveSaleId}`);
      return NextResponse.json({ status: "duplicate", saleId: effectiveSaleId });
    }
  }

  // ── Resolve plan ──
  const planId = resolvePlanId(product.name, product.price);

  // ── User resolution (provider IDs primary, email fallback) ──
  // Constraint #3: Do NOT auto-create stub users. Unmatched → pending
  let matchedUserId: string | null = null;
  let reconciliationStatus = "none";

  try {
    // 1) Primary: match by customerId in User table
    const userByCustomerId = await prisma.user.findFirst({
      where: { id: customer.id },
    });

    if (userByCustomerId) {
      matchedUserId = userByCustomerId.id;
      reconciliationStatus = "matched";
    } else {
      // 2) Fallback: match by email
      const userByEmail = customer.email
        ? await prisma.user.findUnique({ where: { email: customer.email } })
        : null;

      if (userByEmail) {
        matchedUserId = userByEmail.id;
        reconciliationStatus = "matched";
      } else {
        reconciliationStatus = "pending";
        console.warn(
          `[Creala] No user match for saleId=${effectiveSaleId} email=${customer.email} — storing as pending`
        );
      }
    }
  } catch (err) {
    console.error("[Creala] User resolution failed:", err);
    reconciliationStatus = "pending";
  }

  // ── Persist order with identity + reconciliation status ──
  try {
    await prisma.order.create({
      data: {
        saleId: effectiveSaleId,
        event,
        userId: matchedUserId,
        customerId: customer.id,
        customerEmail: customer.email,
        customerName: customer.name,
        customerCountry: customer.country,
        productId: product.id,
        productName: product.name,
        price: product.price,
        currency: product.currency,
        planId,
        subscriptionId: subscription?.id ?? null,
        subscriptionInterval: subscription?.interval ?? null,
        nextBillingDate: subscription?.nextBillingDate
          ? new Date(subscription.nextBillingDate)
          : null,
        cancellationDate: subscription?.cancellationDate
          ? new Date(subscription.cancellationDate)
          : null,
        reconciliationStatus,
        isTest,
        rawPayload: payload as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    console.error("[Creala] Failed to persist order:", err);
    return NextResponse.json(
      { error: "Failed to persist order" },
      { status: 500 }
    );
  }

  // ── Update matched user subscription state ──
  if (matchedUserId && planId) {
    try {
      switch (event) {
        case "new_sale":
        case "new_subscription":
          await prisma.user.update({
            where: { id: matchedUserId },
            data: {
              activePlanId: planId,
              subscriptionStatus: "active",
              subscriptionExpiresAt: subscription?.nextBillingDate
                ? new Date(subscription.nextBillingDate)
                : null,
            },
          });
          break;
        case "subscription_renewal":
          await prisma.user.update({
            where: { id: matchedUserId },
            data: {
              subscriptionStatus: "active",
              subscriptionExpiresAt: subscription?.nextBillingDate
                ? new Date(subscription.nextBillingDate)
                : null,
            },
          });
          break;
        case "subscription_cancellation":
          await prisma.user.update({
            where: { id: matchedUserId },
            data: { subscriptionStatus: "cancelled" },
          });
          break;
      }
    } catch (err) {
      console.error("[Creala] Failed to update user subscription:", err);
    }
  }

  // ── Track monetization analytics event ──
  const analyticsEvent = EVENT_TO_ANALYTICS[event];
  if (analyticsEvent) {
    trackServerEvent(analyticsEvent, {
      userId: customer.id,
      planId: planId ?? undefined,
      metadata: {
        saleId: effectiveSaleId,
        productName: product.name,
        price: product.price,
        currency: product.currency,
        event,
        isTest,
        subscriptionId: subscription?.id,
      },
    });
  }

  // ── Log for operational visibility ──
  console.log(
    `[Creala] ${event}: saleId=${effectiveSaleId} customer=${customer.email} plan=${planId} price=${product.price} ${product.currency} test=${isTest}`
  );

  return NextResponse.json({ status: "ok", saleId: effectiveSaleId, planId });
}
