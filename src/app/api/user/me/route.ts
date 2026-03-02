/**
 * GET /api/user/me — returns the current user's profile + subscription status.
 * Used by AppContext for auto-plan-load on login.
 *
 * If the user's email is in ADMIN_ALLOWLIST_EMAILS:
 *   - Returns isOwner: true (client uses this to auto-enable admin)
 *   - Auto-promotes their DB record to coach/active if not already set
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/client";
import { isOwnerEmail } from "@/lib/services/owner-allowlist";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const owner = isOwnerEmail(user.email);

    // Fetch our Prisma User record
    let dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        activePlanId: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!dbUser) {
      // User authenticated with Supabase but no Prisma record yet
      dbUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.full_name ?? null,
          avatarUrl: user.user_metadata?.avatar_url ?? null,
          // Auto-promote owner on first record creation
          ...(owner
            ? {
                activePlanId: "recommended",
                subscriptionStatus: "active",
                subscriptionExpiresAt: null,
              }
            : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          activePlanId: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
        },
      });

      if (owner) {
        console.log(`[Auth] owner_admin_auto_enabled (new user) for ${user.email}`);
      }
    } else if (owner && (dbUser.activePlanId !== "recommended" || dbUser.subscriptionStatus !== "active")) {
      // Auto-promote existing owner record if not already recommended/active
      dbUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          activePlanId: "recommended",
          subscriptionStatus: "active",
          subscriptionExpiresAt: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          activePlanId: true,
          subscriptionStatus: true,
          subscriptionExpiresAt: true,
        },
      });
      console.log(`[Auth] owner_admin_auto_enabled (promoted) for ${user.email}`);
    }

    // Lazy migration: convert legacy plan IDs (pro, coach) to new equivalents
    const LEGACY_PLAN_REMAP: Record<string, string> = { pro: "recommended", coach: "recommended" };
    if (dbUser.activePlanId && LEGACY_PLAN_REMAP[dbUser.activePlanId]) {
      const newPlanId = LEGACY_PLAN_REMAP[dbUser.activePlanId];
      await prisma.user.update({
        where: { id: user.id },
        data: { activePlanId: newPlanId },
      });
      dbUser = { ...dbUser, activePlanId: newPlanId };
      console.log(`[Auth] lazy_plan_migration: ${dbUser.activePlanId} → ${newPlanId} for ${user.email}`);
    }

    return NextResponse.json({ ...dbUser, isOwner: owner });
  } catch (err) {
    console.error("GET /api/user/me error:", err);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
