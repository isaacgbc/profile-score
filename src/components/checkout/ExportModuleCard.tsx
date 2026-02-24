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
}

// Which modules support which formats
const MODULE_FORMATS: Record<ExportModuleId, ExportFormat[]> = {
  "results-summary": ["pdf"],
  "updated-cv": ["pdf"],
  "full-audit": ["json"],
  "linkedin-updates": ["json"],
  "cover-letter": ["json"],
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
}: ExportModuleCardProps) {
  const { t } = useI18n();
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
          <div className="flex items-center gap-2 shrink-0">
            {status === "processing" ? (
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
                {t.checkout.exportDownload}
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
              formats.map((fmt) => (
                <Button
                  key={fmt}
                  variant={fmt === "pdf" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => onGenerate(fmt)}
                >
                  {fmt.toUpperCase()}
                </Button>
              ))
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
