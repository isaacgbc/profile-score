"use client";

import { useI18n } from "@/context/I18nContext";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { CheckIcon } from "@/components/ui/Icons";

export default function ComparisonSection() {
  const { t } = useI18n();

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
      <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] text-center mb-3 animate-slide-up tracking-tight">
        {t.landing.freeTitle}
      </h2>

      <div className="grid md:grid-cols-2 gap-5 mt-10">
        {/* Free column */}
        <Card
          variant="default"
          padding="lg"
          className="animate-slide-up relative"
          style={{ animationDelay: "80ms" }}
        >
          <Badge variant="free" className="mb-5">
            {t.landing.freeLeftTitle}
          </Badge>
          <ul className="space-y-3.5 mt-2">
            {[
              t.landing.freeLeftItem1,
              t.landing.freeLeftItem2,
              t.landing.freeLeftItem3,
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckIcon size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-sm text-[var(--text-secondary)] leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Paid column */}
        <Card
          variant="highlighted"
          padding="lg"
          className="animate-slide-up relative"
          style={{ animationDelay: "160ms" }}
        >
          <Badge variant="accent" className="mb-5">
            {t.landing.freeRightTitle}
          </Badge>
          <ul className="space-y-3.5 mt-2">
            {[
              t.landing.freeRightItem1,
              t.landing.freeRightItem2,
              t.landing.freeRightItem3,
              t.landing.freeRightItem4,
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckIcon size={16} className="text-[var(--accent)] mt-0.5 shrink-0" />
                <span className="text-sm text-[var(--text-secondary)] leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
