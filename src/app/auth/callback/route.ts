/**
 * OAuth / Magic Link callback handler.
 * Exchanges the auth code for a session and upserts a User record in Prisma.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/client";
import { isOwnerEmail } from "@/lib/services/owner-allowlist";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/results";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Upsert User record in Prisma (sync from Supabase auth)
      try {
        await prisma.user.upsert({
          where: { id: data.user.id },
          update: {
            email: data.user.email ?? "",
            name: data.user.user_metadata?.full_name ?? null,
            avatarUrl: data.user.user_metadata?.avatar_url ?? null,
          },
          create: {
            id: data.user.id,
            email: data.user.email ?? "",
            name: data.user.user_metadata?.full_name ?? null,
            avatarUrl: data.user.user_metadata?.avatar_url ?? null,
          },
        });

        // Owner allowlist: auto-set recommended plan + active subscription
        if (isOwnerEmail(data.user.email)) {
          await prisma.user.update({
            where: { id: data.user.id },
            data: {
              activePlanId: "recommended",
              subscriptionStatus: "active",
              subscriptionExpiresAt: null, // permanent — no expiry
            },
          });
          console.log(
            `[Auth] owner_admin_auto_enabled for ${data.user.email}`
          );
        }

        // Reconcile any pending orders for this user's email
        if (data.user.email) {
          const pendingOrders = await prisma.order.findMany({
            where: {
              customerEmail: data.user.email,
              reconciliationStatus: "pending",
            },
          });

          for (const order of pendingOrders) {
            await prisma.order.update({
              where: { id: order.id },
              data: {
                userId: data.user.id,
                reconciliationStatus: "matched",
              },
            });

            // If order has a planId, update user subscription
            if (order.planId) {
              // Map legacy plan IDs to new equivalents
              const LEGACY_PLAN_REMAP: Record<string, string> = { pro: "recommended", coach: "recommended" };
              const effectivePlanId = LEGACY_PLAN_REMAP[order.planId] ?? order.planId;
              await prisma.user.update({
                where: { id: data.user.id },
                data: {
                  activePlanId: effectivePlanId,
                  subscriptionStatus: "active",
                  subscriptionExpiresAt: order.nextBillingDate,
                },
              });
            }
          }

          if (pendingOrders.length > 0) {
            console.log(
              `[Auth] Reconciled ${pendingOrders.length} pending orders for ${data.user.email}`
            );
          }
        }
      } catch (err) {
        // User upsert/reconciliation should never block auth
        console.error("[Auth] User upsert/reconciliation failed:", err);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
