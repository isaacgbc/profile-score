/**
 * Single source-of-truth for the plan-based unlock matrix.
 * Used by both:
 *   - audit-orchestrator.ts (server-side, during generation)
 *   - AppContext.tsx (client-side, when plan changes post-generation)
 *
 * This ensures the locking logic is never duplicated.
 *
 * "Todo junto" gating: any paid plan unlocks ALL sections for the
 * relevant source(s). The distinction of "which source" is handled
 * by what the user provides as input, not by section-level gating.
 */

import type { PlanId } from "@/lib/types";

/**
 * Returns the list of LinkedIn section IDs that should be unlocked for a given plan.
 * Any paid plan (starter or recommended) unlocks ALL LinkedIn sections.
 */
export function getUnlockedLinkedinIds(
  allIds: string[],
  planId: PlanId | null,
  isAdmin: boolean
): string[] {
  if (isAdmin) return allIds;
  if (planId === "starter" || planId === "recommended") return allIds;
  return [];
}

/**
 * Returns the list of CV section IDs that should be unlocked for a given plan.
 * Any paid plan (starter or recommended) unlocks ALL CV sections.
 */
export function getUnlockedCvIds(
  allIds: string[],
  planId: PlanId | null,
  isAdmin: boolean
): string[] {
  if (isAdmin) return allIds;
  if (planId === "starter" || planId === "recommended") return allIds;
  return [];
}

/**
 * Returns whether the cover letter should be unlocked for a given plan.
 * Only the "recommended" ($10) plan includes cover letter.
 */
export function isCoverLetterUnlockedForPlan(
  planId: PlanId | null,
  isAdmin: boolean
): boolean {
  if (isAdmin) return true;
  return planId === "recommended";
}
