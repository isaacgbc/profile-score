import { z } from "zod";

/**
 * Validation schema for POST /api/analytics/track
 *
 * Design decisions:
 * - planId is z.string() (NOT an enum) to avoid hardcoded plan names
 * - sourceType uses a union of known values but remains extensible
 * - metadata is a string-keyed record; the tracker utility sanitizes it
 *   before submission (stripping keys containing content/text/cv/secret etc.)
 */
export const TrackEventInput = z.object({
  eventName: z.string().min(1).max(100),
  sessionId: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
  auditId: z.string().uuid().optional(),
  planId: z.string().max(50).optional(),
  sourceType: z
    .enum(["linkedin", "cv", "both"])
    .optional(),
  locale: z.string().max(5).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  path: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  referrer: z.string().max(1000).optional(),
});

export type TrackEventInput = z.infer<typeof TrackEventInput>;
