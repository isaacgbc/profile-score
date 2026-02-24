"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import DemoStageDots from "./DemoStageDots";
import DemoStageInput from "./DemoStageInput";
import DemoStageAnalysis from "./DemoStageAnalysis";
import DemoStageResults from "./DemoStageResults";
import DemoStageOutput from "./DemoStageOutput";

const STAGE_COUNT = 4;
const STAGE_DURATION = 3500;

function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function LiveDemo() {
  const { t } = useI18n();
  const [activeStage, setActiveStage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const stageLabels = [
    t.landing.demoStage1Label,
    t.landing.demoStage2Label,
    t.landing.demoStage3Label,
    t.landing.demoStage4Label,
  ];

  // Intersection observer — only auto-play when visible
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-play timer
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % STAGE_COUNT);
    }, STAGE_DURATION);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isVisible && !isPaused) {
      startTimer();
    } else {
      stopTimer();
    }
    return stopTimer;
  }, [isVisible, isPaused, startTimer, stopTimer]);

  // Manual stage click — restart timer so new stage gets full duration
  function handleStageClick(stage: number) {
    setActiveStage(stage);
    if (isVisible && !isPaused) {
      startTimer();
    }
  }

  const stages = [DemoStageInput, DemoStageAnalysis, DemoStageResults, DemoStageOutput];

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[var(--surface-secondary)]"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-2 animate-slide-up">
            {t.landing.demoTitle}
          </h2>
          <p className="text-sm text-[var(--text-muted)] animate-slide-up stagger-1">
            {t.landing.demoSubtitle}
          </p>
        </div>

        {/* Stage Navigation */}
        <DemoStageDots
          activeStage={activeStage}
          stageLabels={stageLabels}
          onStageClick={handleStageClick}
        />

        {/* Demo Viewport */}
        <div
          className="relative bg-white rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {stages.map((StageComponent, i) => (
            <div
              key={i}
              className={`${
                i === activeStage
                  ? "demo-stage-enter relative"
                  : "demo-stage-exit absolute inset-0 pointer-events-none"
              }`}
              aria-hidden={i !== activeStage}
            >
              <StageComponent visible={i === activeStage} />
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="flex justify-center mt-8">
          <Link
            href="/input"
            className="btn-gradient inline-flex items-center justify-center gap-1.5 font-medium px-6 py-2.5 text-sm rounded-xl shadow-sm transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
          >
            {t.landing.demoCta}
            <ChevronRight />
          </Link>
        </div>
      </div>
    </section>
  );
}
