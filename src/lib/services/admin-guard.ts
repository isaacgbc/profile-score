import { NextResponse } from "next/server";
import { validateAdminCookie } from "./admin-session";

/**
 * Server-side admin check. Accepts any of:
 *   1. `x-admin-token` header matching ADMIN_SECRET (raw-secret flow)
 *   2. `ps_admin_session` httpOnly cookie (cookie flow from /api/admin/verify or verify-owner)
 *
 * @returns `null` if authorized, or a 403/401 Response if not.
 */
export function assertAdmin(request: Request): Response | null {
  if (isServerAdmin(request)) return null;

  // Check if there's an expired cookie (for session-expired UX)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const hasAdminCookie = cookieHeader.includes("ps_admin_session=");

  if (hasAdminCookie) {
    return NextResponse.json(
      { error: "Session expired", reason: "admin_session_expired" },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { error: "Forbidden", reason: "invalid_admin_session" },
    { status: 403 }
  );
}

/**
 * Check if the request has valid admin credentials (non-throwing).
 * Checks header token first (fast), then falls back to cookie validation.
 */
export function isServerAdmin(request: Request): boolean {
  // 1. Header-based: raw secret (used by sessionStorage flow)
  const token = request.headers.get("x-admin-token");
  if (token && process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET) {
    return true;
  }

  // 2. Cookie-based: signed HMAC cookie (set by /api/admin/verify or /api/admin/verify-owner)
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/(?:^|;\s*)ps_admin_session=([^;]+)/);
  if (match?.[1]) {
    return validateAdminCookie(decodeURIComponent(match[1]));
  }

  return false;
}
