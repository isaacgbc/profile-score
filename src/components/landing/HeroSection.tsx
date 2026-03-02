"use client";

import { type ReactNode, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import Button from "@/components/ui/Button";
import { SparklesIcon, CheckIcon } from "@/components/ui/Icons";

function HighlightedTitle({
  title,
  highlight1,
  highlight2,
}: {
  title: string;
  highlight1: string;
  highlight2: string;
}) {
  const parts: ReactNode[] = [];
  let remaining = title;
  let keyIdx = 0;
  const highlights = [highlight1, highlight2];
  for (const hl of highlights) {
    const idx = remaining.indexOf(hl);
    if (idx === -1) continue;
    if (idx > 0) parts.push(<span key={keyIdx++}>{remaining.slice(0, idx)}</span>);
    parts.push(<span key={keyIdx++} className="text-highlight">{hl}</span>);
    remaining = remaining.slice(idx + hl.length);
  }
  if (remaining) parts.push(<span key={keyIdx++}>{remaining}</span>);
  return <>{parts}</>;
}

function RotatingWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [width, setWidth] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), 3000);
    return () => clearInterval(id);
  }, [words.length]);

  useEffect(() => {
    const el = spanRefs.current[index];
    if (el) {
      setWidth(Math.ceil(el.getBoundingClientRect().width));
      if (!ready) requestAnimationFrame(() => setReady(true));
    }
  }, [index, ready]);

  return (
    <span
      className={`inline-block overflow-hidden h-[1.1em] align-bottom ${ready ? "transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" : ""}`}
      style={width != null ? { width } : undefined}
      aria-live="polite"
    >
      <span
        className="flex flex-col w-max transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ transform: `translateY(-${index * 50}%)` }}
      >
        {words.map((word, i) => (
          <span
            key={word}
            ref={(el) => { spanRefs.current[i] = el; }}
            className="block text-highlight h-[1.1em] leading-[1.1] self-start"
          >
            {word}
          </span>
        ))}
      </span>
    </span>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export default function HeroSection() {
  const { t } = useI18n();
  const landingT = t.landing as Record<string, string>;

  return (
    <section className="relative overflow-hidden noise-overlay">
      {/* Living background orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[var(--accent)] opacity-[0.04] blur-[100px] animate-pulse-glow" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full bg-indigo-500 opacity-[0.03] blur-[80px] animate-pulse-glow-delayed" />

      {/* Thin accent lines */}
      <div className="absolute top-[30%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent accent-line" />
      <div className="absolute top-[70%] left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-400 to-transparent accent-line" style={{ animationDelay: "2s" }} />

      {/* Floating particles */}
      <div className="absolute top-24 left-[8%] w-2 h-2 rounded-full bg-[var(--accent)] opacity-[0.12] animate-float-slow" />
      <div className="absolute top-48 right-[15%] w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-[0.15] animate-float-medium" />
      <div className="absolute bottom-32 left-[25%] w-2.5 h-2.5 rounded-full bg-amber-400 opacity-[0.10] animate-float-slow" style={{ animationDelay: "2s" }} />
      <div className="absolute top-[60%] right-[8%] w-2 h-2 rounded-full bg-indigo-400 opacity-[0.10] animate-float-medium" style={{ animationDelay: "1s" }} />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
        {/* Premium badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-[var(--border)] shadow-sm mb-8 animate-slide-up">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">{t.landing.badgeText}</span>
        </div>

        {/* Headline */}
        <h1 className="text-[2rem] sm:text-[3rem] lg:text-[3.75rem] font-bold text-[var(--text-primary)] tracking-[-0.03em] leading-[1.08] mb-6 animate-slide-up" style={{ animationDelay: "80ms" }}>
          {t.landing.heroTitlePre}
          <RotatingWord words={[t.landing.heroRotateWord1, t.landing.heroRotateWord2]} />
          <HighlightedTitle title={t.landing.heroTitlePost} highlight1={t.landing.heroHighlight1} highlight2={t.landing.heroHighlight2} />
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-5 leading-relaxed animate-slide-up" style={{ animationDelay: "140ms" }}>
          {t.landing.heroSubtitle}
        </p>

        {/* Speed line */}
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] mb-4 animate-slide-up tracking-wide" style={{ animationDelay: "180ms" }}>
          <SparklesIcon size={14} className="text-[var(--accent)]" />
          {t.landing.speedLine}
        </p>

        {/* Trust line (NEW -- Stripe-inspired quantified trust) */}
        <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)] mb-10 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CheckIcon size={12} className="text-emerald-500" />
          {landingT.heroTrustLine ?? "Trusted by 50,000+ professionals from Google, Amazon, and Stripe"}
        </p>

        {/* Dual CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-up" style={{ animationDelay: "220ms" }}>
          <Link href="/features" className="btn-gradient inline-flex items-center justify-center gap-2 font-medium px-7 py-3.5 text-base rounded-xl shadow-sm transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
            {t.landing.cta}
            <ChevronRight />
          </Link>
          <a href="#how-it-works">
            <Button variant="outline" size="lg">{t.landing.ctaSecondary}</Button>
          </a>
        </div>
      </div>
    </section>
  );
}
