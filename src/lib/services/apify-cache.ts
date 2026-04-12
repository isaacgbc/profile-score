/**
 * Apify LinkedIn cache service.
 *
 * Provides URL normalization (canonical form), SHA-256 hashing, and
 * Prisma-backed cache read/write with 24h TTL enforcement.
 *
 * - normalizeLinkedinUrl: raw URL -> canonical `https://linkedin.com/in/{slug}`
 * - hashUrl: SHA-256 hex digest of any string
 * - readCache: returns cached profileData if fresh, null otherwise
 * - writeCache: upserts cache entry with computed expiresAt
 *
 * @see CONTEXT.md D-08, D-09 — cache schema + URL normalization rule
 * @see RESEARCH.md §Example 1 — normalization pattern
 */
import crypto from "crypto";
import { prisma } from "@/lib/db/client";

/** Cache TTL: 24 hours in milliseconds */
export const APIFY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize a LinkedIn profile URL to canonical form.
 *
 * Strips: www/m/country subdomains, trailing slashes, query params,
 * sub-routes after /in/{slug}. Lowercases everything.
 *
 * @throws {Error} with message "APIFY_INVALID_URL" if not a valid LinkedIn profile URL
 */
export function normalizeLinkedinUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("APIFY_INVALID_URL");
  }
  // Strip leading m. / www. / country subdomain (es.linkedin.com)
  const host = url.hostname.toLowerCase().replace(/^(m|www|[a-z]{2})\./, "");
  if (host !== "linkedin.com") throw new Error("APIFY_INVALID_URL");
  let pathname = url.pathname.toLowerCase();
  // /in/{slug}/ -> /in/{slug}
  pathname = pathname.replace(/\/+$/, "");
  if (!pathname.startsWith("/in/")) throw new Error("APIFY_INVALID_URL");
  // Strip anything after the slug (/in/slug/details/... -> /in/slug)
  const m = pathname.match(/^\/in\/([^/]+)/);
  if (!m) throw new Error("APIFY_INVALID_URL");
  return `https://linkedin.com/in/${m[1]}`;
}

/**
 * SHA-256 hash of a string, returned as lowercase hex.
 */
export function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

/**
 * Read a cached LinkedIn profile by normalized URL.
 *
 * Returns the cached `profileData` if the entry exists AND has not expired.
 * Returns `null` on cache miss or expired entry (application-layer TTL).
 */
export async function readCache(
  normalizedUrl: string,
): Promise<unknown | null> {
  const row = await prisma.linkedInProfileCache.findUnique({
    where: { url: normalizedUrl },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null; // TTL expired -> treat as miss
  return row.profileData;
}

/**
 * Write (upsert) a LinkedIn profile into the cache.
 *
 * Sets `expiresAt = now + 24h`. If a row already exists for this URL,
 * it is updated with fresh data and a new expiry.
 */
export async function writeCache(params: {
  normalizedUrl: string;
  profileData: unknown;
  apifyRunId: string | null;
  costUsd: number;
}): Promise<void> {
  const urlHash = hashUrl(params.normalizedUrl);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + APIFY_CACHE_TTL_MS);
  await prisma.linkedInProfileCache.upsert({
    where: { url: params.normalizedUrl },
    create: {
      url: params.normalizedUrl,
      urlHash,
      profileData: params.profileData as any,
      scrapedAt: now,
      expiresAt,
      apifyRunId: params.apifyRunId,
      costUsd: params.costUsd as any,
    },
    update: {
      urlHash,
      profileData: params.profileData as any,
      scrapedAt: now,
      expiresAt,
      apifyRunId: params.apifyRunId,
      costUsd: params.costUsd as any,
    },
  });
}
