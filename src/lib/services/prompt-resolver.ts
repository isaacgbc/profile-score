import { prisma } from "@/lib/db/client";
import type { Locale } from "@/lib/types";

// ── Sprint 2: In-memory prompt cache with TTL ──────────
interface CachedPrompt {
  content: string;
  version: number;
  cachedAt: number;
}

const PROMPT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const promptCache = new Map<string, CachedPrompt>();

function getCacheKey(key: string, locale: Locale): string {
  return `${key}:${locale}`;
}

function getCachedEntry(key: string, locale: Locale): CachedPrompt | null {
  const cacheKey = getCacheKey(key, locale);
  const entry = promptCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > PROMPT_CACHE_TTL_MS) {
    promptCache.delete(cacheKey);
    return null;
  }
  return entry;
}

function setCachedEntry(
  key: string,
  locale: Locale,
  content: string,
  version: number
): void {
  const cacheKey = getCacheKey(key, locale);
  promptCache.set(cacheKey, { content, version, cachedAt: Date.now() });
}

/** Clear prompt cache (useful for tests and admin prompt activation) */
export function clearPromptCache(): void {
  promptCache.clear();
}

/** Get prompt cache stats (for diagnostics) */
export function getPromptCacheStats(): { size: number; ttlMs: number } {
  return { size: promptCache.size, ttlMs: PROMPT_CACHE_TTL_MS };
}

/**
 * Resolve the active prompt for a given key and locale.
 * Falls back to "en" if the requested locale has no active prompt.
 * Uses in-memory cache (5-min TTL) to reduce DB queries.
 */
export async function getActivePrompt(
  key: string,
  locale: Locale = "en"
): Promise<string | null> {
  // Check cache first
  const cached = getCachedEntry(key, locale);
  if (cached) return cached.content;

  // Try exact locale match from DB
  const prompt = await prisma.promptRegistry.findFirst({
    where: { promptKey: key, locale, status: "active" },
    orderBy: { version: "desc" },
  });
  if (prompt) {
    setCachedEntry(key, locale, prompt.content, prompt.version);
    return prompt.content;
  }

  // Fallback to "en" if different locale requested
  if (locale !== "en") {
    // Check cache for en fallback
    const cachedEn = getCachedEntry(key, "en");
    if (cachedEn) return cachedEn.content;

    const fallback = await prisma.promptRegistry.findFirst({
      where: { promptKey: key, locale: "en", status: "active" },
      orderBy: { version: "desc" },
    });
    if (fallback) {
      setCachedEntry(key, "en", fallback.content, fallback.version);
      return fallback.content;
    }
  }

  return null;
}

/**
 * Resolve the active prompt with its version for traceability.
 * Returns { content, version } or null if not found.
 * Uses in-memory cache (5-min TTL) to reduce DB queries.
 */
export async function getActivePromptWithVersion(
  key: string,
  locale: Locale = "en"
): Promise<{ content: string; version: number } | null> {
  // Check cache first
  const cached = getCachedEntry(key, locale);
  if (cached) return { content: cached.content, version: cached.version };

  // Try exact locale match from DB
  const prompt = await prisma.promptRegistry.findFirst({
    where: { promptKey: key, locale, status: "active" },
    orderBy: { version: "desc" },
  });
  if (prompt) {
    setCachedEntry(key, locale, prompt.content, prompt.version);
    return { content: prompt.content, version: prompt.version };
  }

  // Fallback to "en"
  if (locale !== "en") {
    // Check cache for en fallback
    const cachedEn = getCachedEntry(key, "en");
    if (cachedEn) return { content: cachedEn.content, version: cachedEn.version };

    const fallback = await prisma.promptRegistry.findFirst({
      where: { promptKey: key, locale: "en", status: "active" },
      orderBy: { version: "desc" },
    });
    if (fallback) {
      setCachedEntry(key, "en", fallback.content, fallback.version);
      return { content: fallback.content, version: fallback.version };
    }
  }

  return null;
}

/**
 * Interpolate `{{variable}}` placeholders in a template string.
 * Unmatched placeholders are left as-is.
 */
export function interpolatePrompt(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (match, key: string) => vars[key] ?? match
  );
}
