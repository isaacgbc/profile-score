"use client";

import { useI18n } from "@/context/I18nContext";
import type { JourneyStep } from "@/lib/types";

interface StepIndicatorProps {
  currentStep: JourneyStep;
}

// 5-step flow: Choose Audit → Upload Docs → Score & Audit → Rewrite Studio → Export
const steps: { key: JourneyStep; number: number }[] = [
  { key: "features", number: 1 },
  { key: "input", number: 2 },
  { key: "results", number: 3 },
  { key: "rewrite-studio", number: 4 },
  { key: "checkout", number: 5 },
];

const stepIndex: Record<JourneyStep, number> = {
  landing: -1,
  features: 0,
  input: 1,
  results: 2,
  "rewrite-studio": 3,
  checkout: 4,
};

export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  const { t } = useI18n();
  const currentIdx = stepIndex[currentStep];

  if (currentStep === "landing") return null;

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4">
      <div className="flex items-center justify-between" role="navigation" aria-label="Progress">
        {steps.map((step, idx) => {
          const isActive = idx === currentIdx;
          const isCompleted = idx < currentIdx;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0
                  transition-all duration-300
                  ${
                    isActive
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : isCompleted
                      ? "bg-[var(--accent-light)] text-[var(--accent)]"
                      : "bg-[var(--surface-secondary)] text-[var(--text-muted)]"
                  }
                `}
                aria-current={isActive ? "step" : undefined}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  step.number
                )}
              </div>

              {idx < steps.length - 1 && (
                <div className="flex-1 h-px mx-1.5">
                  <div
                    className={`h-full transition-colors duration-300 ${
                      idx < currentIdx ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-[var(--text-muted)] mt-2">
        {t.common.step} {currentIdx + 1} {t.common.of} {steps.length}
      </p>
    </div>
  );
}
