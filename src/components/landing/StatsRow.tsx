"use client";

import { useI18n } from "@/context/I18nContext";
import StatCounter from "@/components/ui/StatCounter";

export default function StatsRow() {
  const { t } = useI18n();
  const landingT = t.landing as Record<string, string>;

  const stats = [
    { value: t.landing.stat1Value, label: t.landing.stat1Label },
    { value: t.landing.stat2Value, label: t.landing.stat2Label },
    { value: t.landing.stat3Value, label: t.landing.stat3Label },
    { value: landingT.stat4Value ?? "98%", label: landingT.stat4Label ?? "Satisfaction rate" },
  ];

  return (
    <section className="border-y border-[var(--border-light)] bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-4">
          {stats.map((stat, i) => (
            <div key={i} className={i > 0 && i < 3 ? "sm:border-x sm:border-[var(--border-light)] sm:px-4" : ""}>
              <StatCounter
                value={stat.value}
                label={stat.label}
                className="animate-slide-up"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
