"use client";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ExportStatusBadge from "./ExportStatusBadge";
import { useI18n } from "@/context/I18nContext";
import {
  CheckIcon,
  LockIcon,
  LoaderIcon,
} from "@/components/ui/Icons";
import type { ExportModuleId, ExportFormat, ExportStatus } from "@/lib/types";

interface ExportModuleCardProps {
  moduleId: ExportModuleId;
  name: string;
  desc: string;
  icon: React.ReactNode;
  unlocked: boolean;
  minPlanLabel: string | null;
  moduleState: {
    status: ExportStatus | "idle";
    exportId: string | null;
    error: string | null;
  };
  onGenerate: (format: ExportFormat) => void;
  onDownload: (exportId: string) => void;
  onRetry: (format: ExportFormat) => void;
  onUnlock: () => void;
  animDelay: number;
  /** HOTFIX-3: Disable generation while placeholders remain */
  disabled?: boolean;
  disabledReason?: string;
  /** HOTFIX-5B: Allow bypass export (clean placeholders) — only for placeholder blocks, NOT missing sections */
  canBypass?: boolean;
  onBypassExport?: (format: ExportFormat) => void;
}

// Which modules support which formats
// HOTFIX-4: Updated CV now supports PDF + DOCX
const MODULE_FORMATS: Record<ExportModuleId, ExportFormat[]> = {
  "results-summary": ["pdf"],
  "updated-cv": ["pdf", "docx"],
  "full-audit": ["pdf"],
  "linkedin-updates": ["pdf"],
  "cover-letter": ["pdf"],
};

// HOTFIX-6C: Module-specific download labels (i18n keys)
const MODULE_DOWNLOAD_LABELS: Record<ExportModuleId, string> = {
  "results-summary": "downloadResultsSummary",
  "updated-cv": "downloadUpdatedCv",
  "full-audit": "downloadFullAudit",
  "cover-letter": "downloadCoverLetter",
  "linkedin-updates": "downloadLinkedinUpdates",
};

export default function ExportModuleCard({
  moduleId,
  name,
  desc,
  icon,
  unlocked,
  minPlanLabel,
  moduleState,
  onGenerate,
  onDownload,
  onRetry,
  onUnlock,
  animDelay,
  disabled,
  disabledReason,
  canBypass,
  onBypassExport,
}: ExportModuleCardProps) {
  const { t } = useI18n();
  const checkoutT = t.checkout as Record<string, string>;
  const formats = MODULE_FORMATS[moduleId];
  const { status, exportId } = moduleState;

  return (
    <Card
      variant="default"
      padding="md"
      hoverable={unlocked}
      className={`animate-slide-up transition-all duration-200 ${
        !unlocked ? "opacity-60" : ""
      }`}
      style={{ animationDelay: `${animDelay}ms` }}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-200 ${
            unlocked
              ? "bg-[var(--accent-light)] text-[var(--accent)]"
              : "bg-[var(--surface-secondary)] text-[var(--text-muted)]"
          }`}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {name}
            </h3>
            {unlocked ? (
              status !== "idle" ? (
                <ExportStatusBadge status={status} />
              ) : (
                <Badge variant="success">
                  <CheckIcon size={10} className="mr-0.5" />
                  {t.checkout.included}
                </Badge>
              )
            ) : (
              <Badge variant="muted">
                <LockIcon size={10} className="mr-0.5" />
                {minPlanLabel
                  ? t.checkout.lockedModuleDesc.replace("{plan}", minPlanLabel)
                  : t.checkout.lockedModuleTitle}
              </Badge>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
            {desc}
          </p>
        </div>

        {/* Actions */}
        {unlocked ? (
          <div className="flex flex-col items-end gap-1 shrink-0">
            {disabled && disabledReason ? (
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded max-w-[200px] text-right">
                  {disabledReason}
                </span>
                {/* HOTFIX-EXPORT-CTA: Always render a visible primary Button */}
                {canBypass && onBypassExport ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onBypassExport(formats[0])}
                  >
                    {checkoutT.exportBypassPrimary ?? "Export (clean placeholders)"}
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" disabled>
                    {checkoutT.exportPrimary ?? "Export"}
                  </Button>
                )}
              </div>
            ) : status === "processing" ? (
              <Button variant="primary" size="sm" disabled>
                <LoaderIcon size={14} className="animate-spin mr-1" />
                {t.checkout.exportGenerating}
              </Button>
            ) : status === "ready" && exportId ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onDownload(exportId)}
              >
                {checkoutT[MODULE_DOWNLOAD_LABELS[moduleId]] ?? t.checkout.exportDownload}
              </Button>
            ) : status === "failed" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRetry(formats[0])}
              >
                {t.checkout.exportRetry}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {formats.map((fmt) => (
                  <Button
                    key={fmt}
                    variant={fmt === "pdf" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => onGenerate(fmt)}
                    disabled={disabled}
                  >
                    {fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onUnlock}
            className="shrink-0"
          >
            {t.common.unlock}
          </Button>
        )}
      </div>
    </Card>
  );
}
