/**
 * Deterministic SHA-256 fingerprint for anonymous Apify quota tracking.
 *
 * Combines IP + User-Agent + secret salt into a stable hash that identifies
 * anonymous visitors without storing PII. The salt is read from env INSIDE
 * the function body (not module-level) so tests can change env between calls.
 *
 * @see CONTEXT.md D-11 — AnonymousApifyUsage keyed by fingerprintHash
 * @see rate-limiter.ts — mirrors the IP-fingerprint pattern
 */
import crypto from "crypto";

export function computeFingerprint(
  ip: string,
  userAgent?: string | null,
): string {
  const salt = process.env.APIFY_FINGERPRINT_SALT ?? "ps-apify-v1";
  return crypto
    .createHash("sha256")
    .update(`${ip}\n${userAgent ?? ""}\n${salt}`)
    .digest("hex");
}
