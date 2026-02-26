"use client";

import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { ChevronLeftIcon, ChevronRightIcon, TargetIcon, TrendingUpIcon } from "@/components/ui/Icons";

interface StudioTopBarProps {
  objectiveText?: string;
  objectiveMode?: "job" | "objective";
  hasUnsavedChanges: boolean;
  onContinueToExport: () => void;
}

export default function StudioTopBar({
  objectiveText,
  objectiveMode,
  hasUnsavedChanges,
  onContinueToExport,
}: StudioTopBarProps) {
  const { t } = useI18n();

  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[var(--border-light)] -mx-4 px-4 py-3 mb-6">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Back + objective */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/results">
            <Button variant="ghost" size="sm">
              <span className="flex items-center gap-1">
                <ChevronLeftIcon size={14} />
                <span className="hidden sm:inline">{t.rewriteStudio.backToResults}</span>
              </span>
            </Button>
          </Link>

          {objectiveText && (
            <Badge variant="muted" className="hidden sm:inline-flex truncate max-w-xs">
              <span className="flex items-center gap-1.5">
                {objectiveMode === "job" ? (
                  <TargetIcon size={12} />
                ) : (
                  <TrendingUpIcon size={12} />
                )}
                <span className="truncate">{objectiveText}</span>
              </span>
            </Badge>
          )}
        </div>

        {/* Right: status + continue */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-[var(--text-muted)] hidden sm:block">
            {hasUnsavedChanges
              ? t.rewriteStudio.unsavedChanges
              : t.rewriteStudio.autoSaved}
          </span>
          <Button variant="primary" size="sm" onClick={onContinueToExport}>
            <span className="flex items-center gap-1.5">
              {t.rewriteStudio.continueToExport}
              <ChevronRightIcon size={14} />
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
