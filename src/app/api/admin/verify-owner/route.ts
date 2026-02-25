import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isOwnerEmail } from "@/lib/services/owner-allowlist";
import { createAdminCookie } from "@/lib/services/admin-session";

/**
 * POST /api/admin/verify-owner
 *
 * Verifies that the current Supabase session belongs to an owner-allowlisted
 * email. If so, sets the `ps_admin_session` httpOnly cookie so that all
 * subsequent admin API calls pass `assertAdmin()` via cookie auth.
 *
 * This is the bridge between Supabase auth (owner login) and the admin
 * guard system. Called automatically by AppContext when isOwner is detected.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json(
        { valid: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!isOwnerEmail(user.email)) {
      return NextResponse.json(
        { valid: false, error: "Not an owner" },
        { status: 403 }
      );
    }

    // Create signed admin session cookie (same as /api/admin/verify)
    const cookieValue = createAdminCookie();
    const response = NextResponse.json({ valid: true });

    response.cookies.set("ps_admin_session", cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60, // 8 hours
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("POST /api/admin/verify-owner error:", err);
    return NextResponse.json(
      { valid: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
