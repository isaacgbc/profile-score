/**
 * Owner allowlist — grants permanent admin + full plan access to specified emails.
 *
 * Reads from ADMIN_ALLOWLIST_EMAILS env var (comma-separated, case-insensitive).
 * Server-side only. Used in:
 *   - /api/user/me (returns isOwner flag + auto-promotes user record)
 *   - /api/audit/generate (trusts admin if allowlisted session)
 *   - /auth/callback (auto-sets coach plan on login)
 */

/**
 * Parses ADMIN_ALLOWLIST_EMAILS into a Set of lowercased emails.
 * Cached at module level for performance.
 */
function parseAllowlist(): Set<string> {
  const raw = process.env.ADMIN_ALLOWLIST_EMAILS ?? "";
  if (!raw.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes("@"))
  );
}

let _cached: Set<string> | null = null;

function getAllowlist(): Set<string> {
  // Re-parse on every call in dev (hot reload), cache in production
  if (process.env.NODE_ENV === "production" && _cached) return _cached;
  _cached = parseAllowlist();
  return _cached;
}

/**
 * Returns true if the given email is in the owner allowlist.
 * Case-insensitive comparison.
 */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAllowlist().has(email.trim().toLowerCase());
}
