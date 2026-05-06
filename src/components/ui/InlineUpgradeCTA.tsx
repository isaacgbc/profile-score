"use client";

import { useI18n } from "@/context/I18nContext";
import { ChevronRightIcon } from "./Icons";

interface InlineUpgradeCTAProps {
  /** Context determines which i18n string to use */
  context: "section" | "rewrite" | "export";
  /** Number of locked items (for "{count}" interpolation) */
  totalLocked: number;
  onUpgrade: () => void;
  className?: string;
}

export default function InlineUpgradeCTA({
  context,
  totalLocked,
  onUpgrade,
  className = "",
}: InlineUpgradeCTAProps) {
  const { t } = useI18n();
  const fp = (t as unknown as Record<string, Record<string, string>>).freePreview ?? {};

  let label: string;
  switch (context) {
    case "section":
      label = (fp.unlockAllSections ?? "Unlock all {count} sections — $5").replace(
        "{count}",
        String(totalLocked)
      );
      break;
    case "rewrite":
      label = fp.unlockRewrites ?? "Unlock all rewrites — $5";
      break;
    case "export":
      label = fp.unlockExports ?? "Unlock exports — $5";
      break;
  }

  return (
    <button
      onClick={onUpgrade}
      className={`group inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline transition-colors ${className}`}
    >
      {label}
      <ChevronRightIcon
        size={12}
        className="transition-transform group-hover:translate-x-0.5"
      />
    </button>
  );
}
