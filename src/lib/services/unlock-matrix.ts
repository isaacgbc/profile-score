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
 *
 * Free tier preview: free users see the first FREE_PREVIEW_SECTION_COUNT
 * sections fully unlocked (with freePreview flag) and the first
 * FREE_PREVIEW_REWRITE_COUNT rewrites unlocked as a teaser.
 */

import type { PlanId } from "@/lib/types";

/** Number of sections to fully unlock for free users as a preview */
export const FREE_PREVIEW_SECTION_COUNT = 2;

/** Number of rewrites to fully unlock for free users as a preview */
export const FREE_PREVIEW_REWRITE_COUNT = 1;

/**
 * Returns the IDs of sections to show as free preview (first N by array order).
 */
export function getFreePreviewSectionIds(
  allIds: string[]
): string[] {
  return allIds.slice(0, FREE_PREVIEW_SECTION_COUNT);
}

/**
 * Returns the sectionIds of rewrites to show as free preview (first N by array order).
 */
export function getFreePreviewRewriteIds(
  allRewriteSectionIds: string[]
): string[] {
  return allRewriteSectionIds.slice(0, FREE_PREVIEW_REWRITE_COUNT);
}

/**
 * Returns the list of LinkedIn section IDs that should be unlocked for a given plan.
 * Any paid plan (starter or recommended) unlocks ALL LinkedIn sections.
 * Free users (null plan) get the first FREE_PREVIEW_SECTION_COUNT sections.
 */
export function getUnlockedLinkedinIds(
  allIds: string[],
  planId: PlanId | null,
  isAdmin: boolean
): string[] {
  if (isAdmin) return allIds;
  if (planId === "starter" || planId === "recommended") return allIds;
  return getFreePreviewSectionIds(allIds);
}

/**
 * Returns the list of CV section IDs that should be unlocked for a given plan.
 * Any paid plan (starter or recommended) unlocks ALL CV sections.
 * Free users (null plan) get the first FREE_PREVIEW_SECTION_COUNT sections.
 */
export function getUnlockedCvIds(
  allIds: string[],
  planId: PlanId | null,
  isAdmin: boolean
): string[] {
  if (isAdmin) return allIds;
  if (planId === "starter" || planId === "recommended") return allIds;
  return getFreePreviewSectionIds(allIds);
}

/**
 * Returns the list of LinkedIn rewrite sectionIds that should be unlocked for a given plan.
 * Any paid plan unlocks ALL. Free users get first FREE_PREVIEW_REWRITE_COUNT.
 */
export function getUnlockedLinkedinRewriteIds(
  allRewriteSectionIds: string[],
  planId: PlanId | null,
  isAdmin: boolean
): string[] {
  if (isAdmin) return allRewriteSectionIds;
  if (planId === "starter" || planId === "recommended") return allRewriteSectionIds;
  return getFreePreviewRewriteIds(allRewriteSectionIds);
}

/**
 * Returns the list of CV rewrite sectionIds that should be unlocked for a given plan.
 * Any paid plan unlocks ALL. Free users get first FREE_PREVIEW_REWRITE_COUNT.
 */
export function getUnlockedCvRewriteIds(
  allRewriteSectionIds: string[],
  planId: PlanId | null,
  isAdmin: boolean
): string[] {
  if (isAdmin) return allRewriteSectionIds;
  if (planId === "starter" || planId === "recommended") return allRewriteSectionIds;
  return getFreePreviewRewriteIds(allRewriteSectionIds);
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
