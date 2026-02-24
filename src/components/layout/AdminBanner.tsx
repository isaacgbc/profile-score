"use client";

import { useApp } from "@/context/AppContext";
import { useI18n } from "@/context/I18nContext";

export default function AdminBanner() {
  const { isAdmin } = useApp();
  const { t } = useI18n();

  if (!isAdmin) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-xs font-medium text-amber-700">
          {t.common.adminMode} &mdash; {t.common.adminModeDesc}
        </span>
      </div>
    </div>
  );
}
