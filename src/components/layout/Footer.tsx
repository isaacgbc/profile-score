"use client";

import { useI18n } from "@/context/I18nContext";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-[var(--border-light)] bg-[var(--surface)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[var(--accent)] flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">PS</span>
            </div>
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
