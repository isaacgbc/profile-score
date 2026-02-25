import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/services/rate-limiter";
import { createAdminCookie, verifyAdminSecret } from "@/lib/services/admin-session";

// Rate limit: 3 attempts per minute per IP
const verifyLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 3,
});

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);

  // Rate limit check
  const limit = verifyLimiter.check(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { valid: false, error: "Too many attempts. Please wait." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 60) } }
    );
  }

  try {
    const body = await request.json();
    const { secret } = body;

    if (!secret || typeof secret !== "string") {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    // Timing-safe comparison
    if (!verifyAdminSecret(secret)) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // Create signed cookie
    const cookieValue = createAdminCookie();
    const response = NextResponse.json({ valid: true });

    response.cookies.set("ps_admin_session", cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60, // 8 hours in seconds
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ valid: false }, { status: 400 });
  }
}
