"use client";

import Badge from "@/components/ui/Badge";
import { useI18n } from "@/context/I18nContext";
import type { ExportStatus } from "@/lib/types";

interface ExportStatusBadgeProps {
  status: ExportStatus | "idle";
}

export default function ExportStatusBadge({ status }: ExportStatusBadgeProps) {
  const { t } = useI18n();

  switch (status) {
    case "queued":
      return <Badge variant="muted">{t.checkout.exportQueued}</Badge>;
    case "processing":
      return <Badge variant="accent">{t.checkout.exportProcessing}</Badge>;
    case "ready":
      return <Badge variant="success">{t.checkout.exportReady}</Badge>;
    case "failed":
      return <Badge variant="error">{t.checkout.exportFailed}</Badge>;
    default:
      return null;
  }
}
