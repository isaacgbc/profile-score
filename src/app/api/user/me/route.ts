/**
 * GET /api/user/me — returns the current user's profile + subscription status.
 * Used by AppContext for auto-plan-load on login.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/client";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch our Prisma User record
    const dbUser = await prisma.user.findUnique({
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
      // Create one on the fly
      const newUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email ?? "",
          name: user.user_metadata?.full_name ?? null,
          avatarUrl: user.user_metadata?.avatar_url ?? null,
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

      return NextResponse.json(newUser);
    }

    return NextResponse.json(dbUser);
  } catch (err) {
    console.error("GET /api/user/me error:", err);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}
