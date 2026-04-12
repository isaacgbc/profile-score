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
 * A single experience entry. All fields optional — HarvestAPI may use either
 * `position`/`title` or `company`/`companyName` depending on actor version.
 */
const experienceEntrySchema = z
  .object({
    position: z.string().optional(),
    title: z.string().optional(),
    company: z.string().optional(),
    companyName: z.string().optional(),
    duration: z.string().optional(),
    dateRange: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    skills: z.array(z.string()).optional(),
  })
  .passthrough();

/**
 * Loose profile schema — every field optional.
 * `.passthrough()` keeps unknown fields around so future plans can read them
 * without schema bumps.
 */
export const harvestProfileSchema = z
  .object({
    publicIdentifier: z.string().optional(),
    linkedinUrl: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    headline: z.string().optional(),
    about: z.string().optional(),
    location: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .optional(),
    experience: z.array(experienceEntrySchema).optional().default([]),
    education: z.array(z.object({}).passthrough()).optional().default([]),
    skills: z.array(z.object({}).passthrough()).optional().default([]),
    topSkills: z.array(z.string()).optional().default([]),
    certifications: z.array(z.object({}).passthrough()).optional().default([]),
    recommendations: z.array(z.object({}).passthrough()).optional().default([]),
    projects: z.array(z.object({}).passthrough()).optional().default([]),
    languages: z.array(z.object({}).passthrough()).optional().default([]),
    publications: z.array(z.object({}).passthrough()).optional().default([]),
    honors: z.array(z.object({}).passthrough()).optional().default([]),
    volunteering: z.array(z.object({}).passthrough()).optional().default([]),
    connectionsCount: z.number().optional(),
    followerCount: z.number().optional(),
  })
  .passthrough();

export type HarvestProfile = z.infer<typeof harvestProfileSchema>;
