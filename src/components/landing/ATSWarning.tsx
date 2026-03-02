"use client";

import { useI18n } from "@/context/I18nContext";
import { ShieldIcon } from "@/components/ui/Icons";

export default function ATSWarning() {
  const { t } = useI18n();

  return (
    <section className="relative overflow-hidden bg-gradient-to-r from-amber-50 via-amber-50/80 to-amber-50">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-100/30 via-transparent to-amber-100/30" />
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-4 justify-center text-center animate-slide-up">
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-amber-100 items-center justify-center shrink-0">
            <ShieldIcon size={20} className="text-amber-600" />
          </div>
          <p className="text-sm sm:text-base font-medium text-amber-900 leading-relaxed max-w-2xl">
            {t.landing.atsWarning}
          </p>
        </div>
      </div>
    </section>
  );
}
