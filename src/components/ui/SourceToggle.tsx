"use client";

import { useI18n } from "@/context/I18nContext";
import type { SourceType } from "@/lib/types";
import { SearchIcon, FileTextIcon } from "@/components/ui/Icons";

interface SourceToggleProps {
  active: SourceType;
  onChange: (source: SourceType) => void;
  className?: string;
}

export default function SourceToggle({
  active,
  onChange,
  className = "",
}: SourceToggleProps) {
  const { t } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label="Source toggle"
      className={`inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-light)] ${className}`}
    >
      <button
        role="radio"
        aria-checked={active === "linkedin"}
        onClick={() => onChange("linkedin")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          active === "linkedin"
            ? "bg-white shadow-sm text-[var(--accent)] border border-[var(--border-light)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        }`}
      >
        <SearchIcon size={15} />
        {t.results.auditToggleLinkedin}
      </button>
      <button
        role="radio"
        aria-checked={active === "cv"}
        onClick={() => onChange("cv")}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          active === "cv"
            ? "bg-white shadow-sm text-[var(--accent)] border border-[var(--border-light)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        }`}
      >
        <FileTextIcon size={15} />
        {t.results.auditToggleCv}
      </button>
    </div>
  );
}
