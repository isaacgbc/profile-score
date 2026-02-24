"use client";

import { useState, useEffect, useRef } from "react";
import { useI18n } from "@/context/I18nContext";
import ProgressBar from "@/components/ui/ProgressBar";
import {
  SparklesIcon,
  SearchIcon,
  BriefcaseIcon,
  BarChartIcon,
  TargetIcon,
} from "@/components/ui/Icons";

interface DemoStageAnalysisProps {
  visible: boolean;
}

export default function DemoStageAnalysis({ visible }: DemoStageAnalysisProps) {
  const { t } = useI18n();
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) {
      setProgress(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const start = Date.now();
    const duration = 2300;

    const frame = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (pct < 100) {
        rafRef.current = requestAnimationFrame(frame);
      }
    };
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  const chips = [
    { icon: SearchIcon, label: t.landing.demoAnalysisChip1, threshold: 0 },
    { icon: BriefcaseIcon, label: t.landing.demoAnalysisChip2, threshold: 25 },
    { icon: BarChartIcon, label: t.landing.demoAnalysisChip3, threshold: 50 },
    { icon: TargetIcon, label: t.landing.demoAnalysisChip4, threshold: 75 },
  ];

  return (
    <div className="flex flex-col items-center gap-5 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mt-2">
        <SparklesIcon size={18} className="text-[var(--accent)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {t.landing.demoAnalysisProgress}
        </span>
        <span className="demo-pulse-dot w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-sm">
        <ProgressBar value={progress} max={100} />
      </div>

      {/* Status Chips */}
      <div className="flex flex-wrap justify-center gap-2">
        {chips.map((chip, i) => {
          const show = progress >= chip.threshold;
          if (!show) return null;
          const Icon = chip.icon;
          return (
            <div
              key={i}
              className="demo-chip-appear flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-medium"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <Icon size={12} />
              {chip.label}
              {progress >= chip.threshold + 25 && (
                <span className="w-1 h-1 rounded-full bg-[var(--success)] ml-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
