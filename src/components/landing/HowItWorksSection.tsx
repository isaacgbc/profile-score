"use client";

import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import Button from "@/components/ui/Button";

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function HowItWorksSection() {
  const { t } = useI18n();

  const howItWorks = [
    { num: "01", title: t.landing.step1Title, desc: t.landing.step1Desc },
    { num: "02", title: t.landing.step2Title, desc: t.landing.step2Desc },
    { num: "03", title: t.landing.step3Title, desc: t.landing.step3Desc },
  ];

  return (
    <section id="how-it-works" className="bg-[var(--surface-secondary)] relative noise-overlay">
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] text-center mb-14 animate-slide-up tracking-tight">
          {t.landing.howItWorks}
        </h2>

        <div className="grid md:grid-cols-3 gap-10 md:gap-6 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-7 left-[20%] right-[20%] h-px bg-gradient-to-r from-[var(--border)] via-[var(--accent)]/20 to-[var(--border)]" />

          {howItWorks.map((step, i) => (
            <div
              key={i}
              className="text-center animate-slide-up relative"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {/* Number circle */}
              <div className="relative inline-flex items-center justify-center w-14 h-14 rounded-full bg-white border-2 border-[var(--accent)]/20 mb-5 shadow-sm">
                <span className="text-lg font-bold text-[var(--accent)]">{step.num}</span>
              </div>

              <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA below how-it-works */}
        <div className="text-center mt-14 animate-slide-up" style={{ animationDelay: "400ms" }}>
          <Link href="/features">
            <Button size="lg">
              {t.landing.cta}
              <ChevronRight />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
