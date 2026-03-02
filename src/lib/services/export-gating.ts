import type { ExportModuleId, PlanId, LegacyPlanId, LEGACY_PLAN_MAP } from "@/lib/types";
import { mockPlans } from "@/lib/mock/plans";

/** Legacy plan ID mapping (imported as value for runtime use) */
const LEGACY_REMAP: Record<string, PlanId> = { pro: "recommended", coach: "recommended" };

interface GatingResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if an export is allowed based on plan and admin status.
 * `isServerAdmin` must be determined server-side only (via ADMIN_SECRET header).
 * Accepts both current and legacy plan IDs for backward compat.
 */
export function checkExportGating(
  exportType: ExportModuleId,
  planId: string | null | undefined,
  isServerAdmin: boolean
): GatingResult {
  if (isServerAdmin) return { allowed: true };
  if (!planId) return { allowed: false, reason: "No plan selected" };

  // Map legacy plan IDs to current equivalents
  const effectivePlanId = (LEGACY_REMAP[planId] ?? planId) as PlanId;

  const plan = mockPlans.find((p) => p.id === effectivePlanId);
  if (!plan) return { allowed: false, reason: "Invalid plan" };
  if (!plan.exportModules.includes(exportType)) {
    return { allowed: false, reason: `Export "${exportType}" not included in "${effectivePlanId}" plan` };
  }
  return { allowed: true };
}
