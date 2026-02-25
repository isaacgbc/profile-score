/**
 * Admin session management using HMAC-signed httpOnly cookies.
 * Uses timingSafeEqual for all secret comparisons to prevent timing attacks.
 */

import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.ADMIN_SECRET ?? "";

const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Create a signed admin session cookie value.
 * Format: timestamp.hmac_signature
 */
export function createAdminCookie(): string {
  const timestamp = Date.now().toString();
  const sig = createHmac("sha256", SECRET).update(timestamp).digest("hex");
  return `${timestamp}.${sig}`;
}

/**
 * Validate an admin session cookie value.
 * - Checks signature integrity with timingSafeEqual
 * - Checks cookie age (max 8 hours)
 */
export function validateAdminCookie(cookie: string): boolean {
  const [timestamp, sig] = cookie.split(".");
  if (!timestamp || !sig) return false;

  // Check expiry
  const age = Date.now() - parseInt(timestamp);
  if (isNaN(age) || age > MAX_AGE_MS || age < 0) return false;

  // Verify signature with timing-safe comparison
  const expected = createHmac("sha256", SECRET).update(timestamp).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/**
 * Timing-safe comparison of the admin secret.
 * Used in the verify endpoint to check the submitted password.
 */
export function verifyAdminSecret(submitted: string): boolean {
  if (!SECRET || !submitted) return false;
  try {
    const a = Buffer.from(submitted, "utf-8");
    const b = Buffer.from(SECRET, "utf-8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
