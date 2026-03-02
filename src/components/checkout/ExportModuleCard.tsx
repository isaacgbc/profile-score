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
  DownloadIcon,
} from "@/components/ui/Icons";
import type { ExportModuleId, ExportFormat, ExportStatus } from "@/lib/types";

interface FormatState {
  status: ExportStatus | "idle";
  exportId: string | null;
  error: string | null;
}

interface ExportModuleCardProps {
  moduleId: ExportModuleId;
  name: string;
  desc: string;
  icon: React.ReactNode;
  unlocked: boolean;
  minPlanLabel: string | null;
  /** Per-format state accessor — each format button tracks its own state */
  getFormatState: (format: ExportFormat) => FormatState;
  onGenerate: (format: ExportFormat) => void;
  onDownload: (exportId: string) => void;
  onRetry: (format: ExportFormat) => void;
  onUnlock: () => void;
  animDelay: number;
  /** Disable generation while placeholders or missing sections remain */
  disabled?: boolean;
  disabledReason?: string;
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

export { MODULE_FORMATS };

export default function ExportModuleCard({
  moduleId,
  name,
  desc,
  icon,
  unlocked,
  minPlanLabel,
  getFormatState,
  onGenerate,
  onDownload,
  onRetry,
  onUnlock,
  animDelay,
  disabled,
  disabledReason,
}: ExportModuleCardProps) {
  const { t } = useI18n();
  const checkoutT = t.checkout as Record<string, string>;
  const formats = MODULE_FORMATS[moduleId];

  // Check if any format has a non-idle status (for the badge)
  const hasActiveFormat = formats.some((fmt) => getFormatState(fmt).status !== "idle");

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
              hasActiveFormat ? (
                <ExportStatusBadge status={
                  // Show aggregate: if any format is processing show that, else first non-idle
                  formats.reduce<ExportStatus | "idle">((agg, fmt) => {
                    const s = getFormatState(fmt).status;
                    if (agg === "processing") return agg;
                    if (s !== "idle") return s;
                    return agg;
                  }, "idle")
                } />
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

        {/* Actions — Per-format independent buttons */}
        {unlocked ? (
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {disabled && disabledReason && (
              <span className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded max-w-[200px] text-right">
                {disabledReason}
              </span>
            )}
            <div className="flex items-center gap-2">
              {formats.map((fmt) => {
                const fmtState = getFormatState(fmt);
                const { status, exportId } = fmtState;

                if (status === "processing") {
                  return (
                    <Button key={fmt} variant="primary" size="sm" disabled className="min-w-[70px]">
                      <LoaderIcon size={14} className="animate-spin mr-1" />
                      {fmt.toUpperCase()}
                    </Button>
                  );
                }

                if (status === "ready" && exportId) {
                  return (
                    <Button
                      key={fmt}
                      variant="primary"
                      size="sm"
                      onClick={() => onDownload(exportId)}
                      className="min-w-[70px]"
                    >
                      <DownloadIcon size={14} className="mr-1" />
                      {fmt.toUpperCase()}
                    </Button>
                  );
                }

                if (status === "failed") {
                  return (
                    <Button
                      key={fmt}
                      variant="outline"
                      size="sm"
                      onClick={() => onRetry(fmt)}
                      className="min-w-[70px] text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {checkoutT.exportRetry ?? "Retry"} {fmt.toUpperCase()}
                    </Button>
                  );
                }

                // idle — show format name button
                return (
                  <Button
                    key={fmt}
                    variant={fmt === "pdf" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => onGenerate(fmt)}
                    disabled={disabled}
                    className="min-w-[70px]"
                  >
                    {fmt.toUpperCase()}
                  </Button>
                );
              })}
            </div>
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
