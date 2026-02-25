/**
 * OAuth / Magic Link callback handler.
 * Exchanges the auth code for a session and upserts a User record in Prisma.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/client";

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
              await prisma.user.update({
                where: { id: data.user.id },
                data: {
                  activePlanId: order.planId,
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
