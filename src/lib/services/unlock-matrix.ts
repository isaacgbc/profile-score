/**
 * Single source-of-truth for the plan-based unlock matrix.
 * Used by both:
 *   - audit-orchestrator.ts (server-side, during generation)
 *   - AppContext.tsx (client-side, when plan changes post-generation)
 *
 * This ensures the locking logic is never duplicated.
 */

import type { PlanId } from "@/lib/types";

/**
 * Returns the list of LinkedIn section IDs that should be unlocked for a given plan.
 */
export function getUnlockedLinkedinIds(
  allIds: string[],
  planId: PlanId | null,
  isAdmin: boolean
): string[] {
  if (isAdmin) return allIds;
  switch (planId) {
    case "coach":
    case "pro":
    case "recommended":
      return allIds;
    case "starter":
      return allIds.filter((id) => ["headline", "summary"].includes(id));
    default:
      return [];
  }
}

/**
 * Returns the list of CV section IDs that should be unlocked for a given plan.
 */
export function getUnlockedCvIds(
  allIds: string[],
  planId: PlanId | null,
  isAdmin: boolean
): string[] {
  if (isAdmin) return allIds;
  switch (planId) {
    case "coach":
    case "pro":
      return allIds;
    case "recommended":
      return allIds.filter((id) =>
        ["contact-info", "professional-summary", "work-experience"].includes(id)
      );
    case "starter":
    default:
      return [];
  }
}

/**
 * Returns whether the cover letter should be unlocked for a given plan.
 */
export function isCoverLetterUnlockedForPlan(
  planId: PlanId | null,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return planId === "coach";
}
