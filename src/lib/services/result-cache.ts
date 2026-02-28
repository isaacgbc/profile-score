/**
 * DB-backed result cache using Prisma GenerationCache model.
 *
 * - SHA-256 hash of input → lookup in DB
 * - 1-hour TTL (survives serverless cold starts)
 * - Upsert on store (idempotent)
 */

import { prisma } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";
import type { ProfileResult } from "@/lib/types";

// ── Cache TTL in milliseconds (1 hour) ──────────────────
const CACHE_TTL_MS = 60 * 60 * 1000;

// ── Parser version — bump to invalidate cache on parser changes ──
// HOTFIX-URGENT-2: Added parser version to cache key.
// Bump this whenever parser logic changes to prevent stale cached results.
const PARSER_VERSION = "v3.7";

// ── Compute SHA-256 hash of input ────────────────────────
// V2: includes objectiveMode + objectiveText for cache key correctness.
// V3.2: includes parser version to invalidate on parser changes.
export async function computeInputHash(input: {
  linkedinText: string;
  cvText?: string;
  jobDescription: string;
  locale: string;
  objectiveMode?: string;
  objectiveText?: string;
}): Promise<string> {
  const raw = JSON.stringify({
    parserVersion: PARSER_VERSION,
    linkedinText: input.linkedinText.trim(),
    cvText: (input.cvText ?? "").trim(),
    jobDescription: input.jobDescription.trim(),
    locale: input.locale,
    objectiveMode: input.objectiveMode ?? "job",
    objectiveText: (input.objectiveText ?? "").trim(),
  });

  // Use Web Crypto API (available in Node 18+ and Edge Runtime)
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Retrieve cached result ───────────────────────────────
export async function getCachedResult(
  inputHash: string
): Promise<{
  results: ProfileResult;
  modelUsed: string;
  promptVersions: Record<string, number>;
} | null> {
  try {
    const cached = await prisma.generationCache.findUnique({
      where: { inputHash },
    });

    if (!cached) return null;

    // Check expiry
    if (cached.expiresAt < new Date()) {
      // Expired — clean up asynchronously and return null
      prisma.generationCache
        .delete({ where: { inputHash } })
        .catch(() => {});
      return null;
    }

    return {
      results: cached.results as unknown as ProfileResult,
      modelUsed: cached.modelUsed,
      promptVersions:
        (cached.promptVersions as Record<string, number>) ?? {},
    };
  } catch {
    // Cache lookup should never break the flow
    return null;
  }
}

// ── Store result in cache ────────────────────────────────
export async function setCachedResult(
  inputHash: string,
  results: ProfileResult,
  modelUsed: string,
  promptVersions: Record<string, number>
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

  try {
    await prisma.generationCache.upsert({
      where: { inputHash },
      update: {
        results: results as unknown as Prisma.InputJsonValue,
        modelUsed,
        promptVersions: promptVersions as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
      create: {
        inputHash,
        results: results as unknown as Prisma.InputJsonValue,
        modelUsed,
        promptVersions: promptVersions as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  } catch {
    // Cache writes should never break the flow
  }
}
