/**
 * Zod schemas for Apify LinkedIn Integration (Phase 01).
 *
 * - `scrapeLinkedinRequestSchema`: validates the POST body of `/api/scrape-linkedin`.
 *   Hardened against SSRF (T-01-01): rejects non-linkedin hosts, `data:`, `javascript:`,
 *   protocol-relative URLs, and host-spoofing attempts (e.g. `evil.com/linkedin.com/in/x`).
 *
 * - `harvestProfileSchema`: loose/defensive validator for the HarvestAPI actor response.
 *   Everything is optional and `.passthrough()` preserves unknown keys — this is the
 *   drift tolerance layer (see A2 in 01-RESEARCH.md Assumptions Log).
 *
 * Error messages on refinements are i18n KEY STRINGS (e.g. `"apify.error.invalidUrl"`)
 * so callers can map `issue.message` directly to a `t()` call without a second lookup.
 */
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Request schema: POST /api/scrape-linkedin body
// ─────────────────────────────────────────────────────────────────────────────

const APIFY_INVALID_URL = "apify.error.invalidUrl";

export const scrapeLinkedinRequestSchema = z.object({
  url: z
    .string()
    .min(10, { message: APIFY_INVALID_URL })
    .max(500, { message: APIFY_INVALID_URL })
    .refine(
      (v) =>
        !v.startsWith("//") &&
        !v.toLowerCase().startsWith("data:") &&
        !v.toLowerCase().startsWith("javascript:"),
      { message: APIFY_INVALID_URL },
    )
    .refine(
      (v) => {
        try {
          const u = new URL(v);
          if (u.protocol !== "https:" && u.protocol !== "http:") return false;
          // hostname.endsWith("linkedin.com") correctly rejects
          // evil.com/linkedin.com/in/... style host-spoofing attempts because
          // the URL parser resolves hostname to "evil.com" in that case.
          if (!u.hostname.endsWith("linkedin.com")) return false;
          if (!u.pathname.startsWith("/in/")) return false;
          // Must have something after /in/ (reject bare "/in/" or "/in")
          const handle = u.pathname.slice("/in/".length).replace(/\/$/, "");
          if (handle.length === 0) return false;
          return true;
        } catch {
          return false;
        }
      },
      { message: APIFY_INVALID_URL },
    ),
});

export type ScrapeLinkedinRequest = z.infer<typeof scrapeLinkedinRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Response schema: HarvestAPI actor output (defensive against drift)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single experience entry. Every string field uses `.nullish()` — HarvestAPI
 * emits `null` (not undefined) for absent string fields on real profiles (e.g.
 * `duration: null` on Bill Gates' probe response). Drift tolerance is critical
 * at this layer — any `null` from the actor must not cause parse failure.
 */
const nullishString = z.string().nullish();

const experienceEntrySchema = z
  .object({
    position: nullishString,
    title: nullishString,
    company: nullishString,
    companyName: nullishString,
    duration: nullishString,
    dateRange: nullishString,
    description: nullishString,
    location: nullishString,
    skills: z.array(z.string()).nullish(),
  })
  .passthrough();

/**
 * Loose profile schema — every field optional.
 * `.passthrough()` keeps unknown fields around so future plans can read them
 * without schema bumps.
 */
export const harvestProfileSchema = z
  .object({
    publicIdentifier: nullishString,
    linkedinUrl: nullishString,
    firstName: nullishString,
    lastName: nullishString,
    headline: nullishString,
    about: nullishString,
    location: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .nullish(),
    experience: z.array(experienceEntrySchema).nullish().default([]),
    education: z.array(z.object({}).passthrough()).nullish().default([]),
    skills: z.array(z.object({}).passthrough()).nullish().default([]),
    topSkills: z.array(z.object({}).passthrough()).nullish().default([]),
    certifications: z.array(z.object({}).passthrough()).nullish().default([]),
    // Field name drift: HarvestAPI actor uses `receivedRecommendations` (probed
    // 2026-04-11 against public profile). Accept both names via passthrough.
    recommendations: z.array(z.object({}).passthrough()).nullish().default([]),
    receivedRecommendations: z
      .array(z.object({}).passthrough())
      .nullish()
      .default([]),
    projects: z.array(z.object({}).passthrough()).nullish().default([]),
    languages: z.array(z.object({}).passthrough()).nullish().default([]),
    publications: z.array(z.object({}).passthrough()).nullish().default([]),
    // Field name drift: HarvestAPI uses `honorsAndAwards` not `honors`.
    honors: z.array(z.object({}).passthrough()).nullish().default([]),
    honorsAndAwards: z.array(z.object({}).passthrough()).nullish().default([]),
    volunteering: z.array(z.object({}).passthrough()).nullish().default([]),
    featured: z.array(z.object({}).passthrough()).nullish().default([]),
    connectionsCount: z.number().nullish(),
    followerCount: z.number().nullish(),
  })
  .passthrough();

export type HarvestProfile = z.infer<typeof harvestProfileSchema>;
