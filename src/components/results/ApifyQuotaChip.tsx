"use client";

import { useI18n } from "@/context/I18nContext";
import type { ApifyQuotaState } from "@/lib/types";

type Props = { quota: ApifyQuotaState | null };

export function ApifyQuotaChip({ quota }: Props) {
  const { t } = useI18n();
  if (!quota) return null;

  const label =
    quota.remaining === null
      ? t.apify.dashboard.unlimited
      : t.apify.dashboard.remaining.replace("{count}", String(quota.remaining));

  return (
    <span
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border"
      style={{
        backgroundColor: "var(--surface-2)",
        color: "var(--text-primary)",
        borderColor: "var(--border-subtle)",
      }}
      aria-label={t.apify.dashboard.label}
      data-testid="apify-quota-chip"
    >
      {label}
    </span>
  );
}
