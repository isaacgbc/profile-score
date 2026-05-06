"use client";

import { useI18n } from "@/context/I18nContext";
import StatCounter from "@/components/ui/StatCounter";
import {
  ShieldIcon,
  TrendingUpIcon,
  BarChartIcon,
  SparklesIcon,
} from "@/components/ui/Icons";

export default function ValueCards() {
  const { t } = useI18n();
  const landingT = t.landing as Record<string, string>;

  const stats = [
    { value: t.landing.stat1Value, label: t.landing.stat1Label },
    { value: t.landing.stat2Value, label: t.landing.stat2Label },
    { value: t.landing.stat3Value, label: t.landing.stat3Label },
    { value: landingT.stat4Value ?? "98%", label: landingT.stat4Label ?? "Satisfaction rate" },
  ];

  const valueCards = [
    { stat: t.landing.valueCard1Stat, statLabel: t.landing.valueCard1StatLabel, title: t.landing.valueCard1Title, desc: t.landing.valueCard1Desc, icon: <ShieldIcon size={20} /> },
    { stat: t.landing.valueCard2Stat, statLabel: t.landing.valueCard2StatLabel, title: t.landing.valueCard2Title, desc: t.landing.valueCard2Desc, icon: <TrendingUpIcon size={20} /> },
    { stat: t.landing.valueCard3Stat, statLabel: t.landing.valueCard3StatLabel, title: t.landing.valueCard3Title, desc: t.landing.valueCard3Desc, icon: <BarChartIcon size={20} /> },
    { stat: t.landing.valueCard4Stat, statLabel: t.landing.valueCard4StatLabel, title: t.landing.valueCard4Title, desc: t.landing.valueCard4Desc, icon: <SparklesIcon size={20} /> },
  ];

  return (
    <section className="relative noise-overlay">
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-20">
        {/* ─── Compact Stats Row (merged from StatsRow) ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-4 mb-14 pb-14 border-b border-[var(--border-light)]">
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

        {/* ─── Value Proposition Cards ─── */}
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {valueCards.map((card, i) => (
            <div
              key={i}
              className="group relative bg-white rounded-2xl border border-[var(--border)] p-6 sm:p-7 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--accent)]/[0.06] hover:-translate-y-0.5 hover:border-[var(--accent)]/20 animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <span className="block text-3xl sm:text-4xl font-bold text-[var(--accent)] tracking-tight leading-none">{card.stat}</span>
                  <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-1 block">{card.statLabel}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors duration-300">{card.icon}</span>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{card.title}</h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{card.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Value reinforcement — no fabricated attributions */}
        <p className="mt-12 text-center text-sm text-[var(--text-muted)] max-w-lg mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: "350ms" }}>
          {landingT.valueReinforcement ?? "If your LinkedIn profile and resume aren't optimized for AI-powered screening, you're losing opportunities before a human ever sees your application."}
        </p>
      </div>
    </section>
  );
}
