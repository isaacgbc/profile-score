import type { ExportModuleId, PlanId } from "@/lib/types";
import { mockPlans } from "@/lib/mock/plans";

interface GatingResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if an export is allowed based on plan and admin status.
 * `isServerAdmin` must be determined server-side only (via ADMIN_SECRET header).
 */
export function checkExportGating(
  exportType: ExportModuleId,
  planId: PlanId | null | undefined,
  isServerAdmin: boolean
): GatingResult {
  if (isServerAdmin) return { allowed: true };
  if (!planId) return { allowed: false, reason: "No plan selected" };
  const plan = mockPlans.find((p) => p.id === planId);
  if (!plan) return { allowed: false, reason: "Invalid plan" };
  if (!plan.exportModules.includes(exportType)) {
    return { allowed: false, reason: `Export "${exportType}" not included in "${planId}" plan` };
  }
  return { allowed: true };
}
