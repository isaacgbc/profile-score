"use client";

import { useI18n } from "@/context/I18nContext";
import BrandLogo from "@/components/ui/BrandLogo";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[var(--border-light)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandLogo size={24} />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              {t.common.brandName}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            &copy; {new Date().getFullYear()} {t.common.brandName}. {t.common.subtitle}.
          </p>
        </div>
      </div>
    </footer>
  );
}
