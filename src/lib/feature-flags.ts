import type { FeatureFlags } from "./types";

export const featureFlags: FeatureFlags = {
  paymentsEnabled:
    process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true",
  adminBypass:
    process.env.NEXT_PUBLIC_ADMIN_BYPASS === "true",
};
