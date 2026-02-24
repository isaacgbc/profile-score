import { NextResponse } from "next/server";

/**
 * Server-side admin check. Reads `x-admin-token` header and validates
 * against the ADMIN_SECRET env var.
 *
 * @returns `null` if authorized, or a 403 Response if not.
 */
export function assertAdmin(request: Request): Response | null {
  const token = request.headers.get("x-admin-token");
  if (!process.env.ADMIN_SECRET || token !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Check if the request has a valid admin token (non-throwing).
 */
export function isServerAdmin(request: Request): boolean {
  const token = request.headers.get("x-admin-token");
  return !!process.env.ADMIN_SECRET && token === process.env.ADMIN_SECRET;
}
