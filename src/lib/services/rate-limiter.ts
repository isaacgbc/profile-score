interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

/**
 * Simple in-memory sliding window rate limiter.
 * Suitable for prototype / single-instance deployments.
 */
export function createRateLimiter(config: RateLimiterConfig) {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup every 60s to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < config.windowMs
      );
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 60_000);

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      const entry = store.get(key) ?? { timestamps: [] };

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter(
        (ts) => now - ts < config.windowMs
      );

      if (entry.timestamps.length >= config.maxRequests) {
        const oldestInWindow = entry.timestamps[0];
        const retryAfter = Math.ceil(
          (oldestInWindow + config.windowMs - now) / 1000
        );
        return { allowed: false, retryAfter };
      }

      entry.timestamps.push(now);
      store.set(key, entry);
      return { allowed: true };
    },
  };
}

/** Shared rate limiter for export creation: 10 requests per minute per key */
export const exportRateLimiter = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});
