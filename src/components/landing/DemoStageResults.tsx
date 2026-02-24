"use client";

import { useI18n } from "@/context/I18nContext";
import ScoreRing from "@/components/ui/ScoreRing";
import Badge from "@/components/ui/Badge";
import { TrendingUpIcon, SparklesIcon } from "@/components/ui/Icons";

interface DemoStageResultsProps {
  visible: boolean;
}

export default function DemoStageResults({ visible }: DemoStageResultsProps) {
  const { t } = useI18n();

  const improvements = [
    t.landing.demoResultsImprove1,
    t.landing.demoResultsImprove2,
    t.landing.demoResultsImprove3,
  ];

  const sections = [
    { label: t.landing.demoResultsSection1, tip: t.landing.demoResultsSection1Tip },
    { label: t.landing.demoResultsSection2, tip: t.landing.demoResultsSection2Tip },
    { label: t.landing.demoResultsSection3, tip: t.landing.demoResultsSection3Tip },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-5 p-5 sm:p-6">
      {/* Score Column */}
      <div
        className={`flex flex-col items-center gap-2 sm:w-2/5 ${
          visible ? "demo-score-reveal" : "opacity-0"
        }`}
      >
        <ScoreRing
          score={78}
          maxScore={100}
          tier="good"
          size="md"
          showLabel
          label={t.landing.demoResultsLabel}
          animate={visible}
        />
        <Badge variant="success">{t.landing.demoResultsTier}</Badge>
      </div>

      {/* Improvements Column */}
      <div className="flex flex-col gap-3 sm:w-3/5">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Things to improve
        </p>
        <div className="flex flex-col gap-2">
          {improvements.map((text, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-xs text-[var(--text-secondary)] ${
                visible ? "demo-chip-appear" : "opacity-0"
              }`}
              style={{ animationDelay: `${300 + i * 120}ms` }}
            >
              <TrendingUpIcon
                size={14}
                className="text-[var(--warning)] shrink-0 mt-0.5"
              />
              {text}
            </div>
          ))}
        </div>

        {/* Section Preview Cards */}
        <div className="flex flex-col gap-1.5 mt-1">
          {sections.map((section, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-light)] ${
                visible ? "demo-chip-appear" : "opacity-0"
              }`}
              style={{ animationDelay: `${660 + i * 100}ms` }}
            >
              <SparklesIcon size={12} className="text-[var(--accent)] shrink-0" />
              <span className="text-[11px] font-medium text-[var(--text-primary)]">
                {section.label}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] ml-auto truncate max-w-[55%] text-right">
                {section.tip}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
