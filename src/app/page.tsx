"use client";

import { type ReactNode, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useI18n } from "@/context/I18nContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StatCounter from "@/components/ui/StatCounter";
import {
  SearchIcon,
  FileTextIcon,
  TargetIcon,
  MailIcon,
  CheckIcon,
  StarIcon,
  SparklesIcon,
  ShieldIcon,
  TrendingUpIcon,
  BarChartIcon,
} from "@/components/ui/Icons";
import LiveDemo from "@/components/landing/LiveDemo";

/* ─── Helper: highlight keywords in hero title ──────── */
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

    if (idx > 0) {
      parts.push(<span key={keyIdx++}>{remaining.slice(0, idx)}</span>);
    }
    parts.push(
      <span key={keyIdx++} className="text-highlight">
        {hl}
      </span>
    );
    remaining = remaining.slice(idx + hl.length);
  }

  if (remaining) {
    parts.push(<span key={keyIdx++}>{remaining}</span>);
  }

  return <>{parts}</>;
}

/* ─── Rotating word (LinkedIn ↔ CV) ────────────────── */
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
      className={`inline-block overflow-hidden h-[1.1em] align-bottom ${
        ready ? "transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" : ""
      }`}
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

/* ─── Chevron icon inline ──────────────────────────── */
function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
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

/* ─── Main Landing Page ────────────────────────────── */
export default function LandingPage() {
  const { t } = useI18n();

  const features = [
    { icon: <SearchIcon size={22} />, title: t.landing.featureBenefit1Title, desc: t.landing.featureBenefit1Desc },
    { icon: <FileTextIcon size={22} />, title: t.landing.featureBenefit2Title, desc: t.landing.featureBenefit2Desc },
    { icon: <TargetIcon size={22} />, title: t.landing.featureBenefit3Title, desc: t.landing.featureBenefit3Desc },
    { icon: <MailIcon size={22} />, title: t.landing.featureBenefit4Title, desc: t.landing.featureBenefit4Desc },
  ];

  const valueCards = [
    { stat: t.landing.valueCard1Stat, statLabel: t.landing.valueCard1StatLabel, title: t.landing.valueCard1Title, desc: t.landing.valueCard1Desc, icon: <ShieldIcon size={20} /> },
    { stat: t.landing.valueCard2Stat, statLabel: t.landing.valueCard2StatLabel, title: t.landing.valueCard2Title, desc: t.landing.valueCard2Desc, icon: <TrendingUpIcon size={20} /> },
    { stat: t.landing.valueCard3Stat, statLabel: t.landing.valueCard3StatLabel, title: t.landing.valueCard3Title, desc: t.landing.valueCard3Desc, icon: <BarChartIcon size={20} /> },
    { stat: t.landing.valueCard4Stat, statLabel: t.landing.valueCard4StatLabel, title: t.landing.valueCard4Title, desc: t.landing.valueCard4Desc, icon: <SparklesIcon size={20} /> },
  ];

  const testimonials = [
    { quote: t.landing.socialProof1, author: t.landing.socialProof1Author, role: t.landing.socialProof1Role, metric: t.landing.socialProof1Metric },
    { quote: t.landing.socialProof2, author: t.landing.socialProof2Author, role: t.landing.socialProof2Role, metric: t.landing.socialProof2Metric },
    { quote: t.landing.socialProof3, author: t.landing.socialProof3Author, role: t.landing.socialProof3Role, metric: t.landing.socialProof3Metric },
  ];

  const howItWorks = [
    { num: "01", title: t.landing.step1Title, desc: t.landing.step1Desc },
    { num: "02", title: t.landing.step2Title, desc: t.landing.step2Desc },
    { num: "03", title: t.landing.step3Title, desc: t.landing.step3Desc },
  ];

  const trustCompanies = ["Google", "Amazon", "Meta", "Apple", "Microsoft", "Netflix", "Spotify", "Stripe"];

  return (
    <div className="animate-fade-in relative">

      {/* ══════════════════════════════════════════════════════
          HERO SECTION
          ══════════════════════════════════════════════════════ */}
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
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-[var(--border)] shadow-sm mb-8 animate-slide-up"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-[var(--text-secondary)] tracking-wide">
              {t.landing.badgeText}
            </span>
          </div>

          {/* Headline with rotating LinkedIn/CV + gradient highlights */}
          <h1
            className="text-[2rem] sm:text-[3rem] lg:text-[3.75rem] font-bold text-[var(--text-primary)] tracking-[-0.03em] leading-[1.08] mb-6 animate-slide-up"
            style={{ animationDelay: "80ms" }}
          >
            {t.landing.heroTitlePre}
            <RotatingWord
              words={[t.landing.heroRotateWord1, t.landing.heroRotateWord2]}
            />
            <HighlightedTitle
              title={t.landing.heroTitlePost}
              highlight1={t.landing.heroHighlight1}
              highlight2={t.landing.heroHighlight2}
            />
          </h1>

          {/* Subtitle */}
          <p
            className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl mx-auto mb-5 leading-relaxed animate-slide-up"
            style={{ animationDelay: "140ms" }}
          >
            {t.landing.heroSubtitle}
          </p>

          {/* Speed line */}
          <p
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] mb-10 animate-slide-up tracking-wide"
            style={{ animationDelay: "180ms" }}
          >
            <SparklesIcon size={14} className="text-[var(--accent)]" />
            {t.landing.speedLine}
          </p>

          {/* Dual CTAs */}
          <div
            className="flex flex-col sm:flex-row gap-3 justify-center animate-slide-up"
            style={{ animationDelay: "220ms" }}
          >
            <Link
              href="/input"
              className="btn-gradient inline-flex items-center justify-center gap-2 font-medium px-7 py-3.5 text-base rounded-xl shadow-sm transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              {t.landing.cta}
              <ChevronRight />
            </Link>
            <a href="#how-it-works">
              <Button variant="outline" size="lg">
                {t.landing.ctaSecondary}
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          LIVE PRODUCT DEMO
          ══════════════════════════════════════════════════════ */}
      <LiveDemo />

      {/* ══════════════════════════════════════════════════════
          STATS ROW
          ══════════════════════════════════════════════════════ */}
      <section className="border-y border-[var(--border-light)] bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4">
            <StatCounter
              value={t.landing.stat1Value}
              label={t.landing.stat1Label}
              className="animate-slide-up"
            />
            <div className="hidden sm:block">
              <StatCounter
                value={t.landing.stat2Value}
                label={t.landing.stat2Label}
                className="animate-slide-up sm:border-x sm:border-[var(--border-light)] sm:px-4"
              />
            </div>
            <div className="sm:hidden">
              <StatCounter
                value={t.landing.stat2Value}
                label={t.landing.stat2Label}
                className="animate-slide-up"
              />
            </div>
            <StatCounter
              value={t.landing.stat3Value}
              label={t.landing.stat3Label}
              className="animate-slide-up"
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          VALUE CARDS (4-card grid with stat emphasis)
          ══════════════════════════════════════════════════════ */}
      <section className="relative noise-overlay">
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
            {valueCards.map((card, i) => (
              <div
                key={i}
                className="group relative bg-white rounded-2xl border border-[var(--border)] p-6 sm:p-7 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--accent)]/[0.06] hover:-translate-y-0.5 hover:border-[var(--accent)]/20 animate-slide-up"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Top accent line */}
                <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="flex items-start gap-4">
                  {/* Large stat */}
                  <div className="shrink-0">
                    <span className="block text-3xl sm:text-4xl font-bold text-[var(--accent)] tracking-tight leading-none">
                      {card.stat}
                    </span>
                    <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mt-1 block">
                      {card.statLabel}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors duration-300">
                        {card.icon}
                      </span>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {card.title}
                      </h3>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {card.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          ATS WARNING BANNER
          ══════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════
          FEATURES GRID
          ══════════════════════════════════════════════════════ */}
      <section className="bg-[var(--surface-secondary)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] text-center mb-3 animate-slide-up tracking-tight">
            {t.landing.featuresTitle}
          </h2>
          <p className="text-sm text-[var(--text-muted)] text-center mb-12 animate-slide-up" style={{ animationDelay: "60ms" }}>
            {t.landing.featuresSubtitle}
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, i) => (
              <Card
                key={i}
                variant="default"
                padding="lg"
                hoverable
                className="animate-slide-up group"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--accent-light)] text-[var(--text-muted)] flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 group-hover:text-[var(--accent)] group-hover:shadow-md group-hover:shadow-[var(--accent)]/10">
                  {feature.icon}
                </div>
                <h3 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {feature.desc}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FREE vs PAID COMPARISON
          ══════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════
          SOCIAL PROOF
          ══════════════════════════════════════════════════════ */}
      <section className="bg-white border-y border-[var(--border-light)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] text-center mb-12 animate-slide-up tracking-tight">
            {t.landing.socialProofTitle}
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((item, i) => (
              <Card
                key={i}
                variant="default"
                padding="md"
                hoverable
                className="animate-slide-up group"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <StarIcon key={s} size={14} className="text-amber-400" />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5 italic">
                  &ldquo;{item.quote}&rdquo;
                </p>

                {/* Metric badge */}
                <div className="mb-4">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                    <TrendingUpIcon size={12} />
                    {item.metric}
                  </span>
                </div>

                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
                    {item.author.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {item.author}
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {item.role}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TRUST MARQUEE
          ══════════════════════════════════════════════════════ */}
      <section className="py-14 overflow-hidden">
        <p className="text-[11px] text-[var(--text-muted)] text-center uppercase tracking-[0.2em] font-semibold mb-8">
          {t.landing.trustedBy}
        </p>

        {/* Marquee container with fade edges */}
        <div className="relative">
          {/* Left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[var(--surface)] to-transparent z-10 pointer-events-none" />
          {/* Right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[var(--surface)] to-transparent z-10 pointer-events-none" />

          <div className="flex animate-marquee" style={{ width: "max-content" }}>
            {/* Duplicate the list for seamless loop */}
            {[...trustCompanies, ...trustCompanies].map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="inline-flex items-center justify-center px-8 sm:px-12 text-base sm:text-lg font-semibold text-[var(--text-primary)] opacity-[0.18] select-none tracking-wide whitespace-nowrap"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
          ══════════════════════════════════════════════════════ */}
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
            <Link href="/input">
              <Button size="lg">
                {t.landing.cta}
                <ChevronRight />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          BOTTOM CTA
          ══════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-[var(--accent-light)]/40 to-[var(--accent-light)]" />
        {/* Decorative orb */}
        <div className="absolute bottom-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[var(--accent)] opacity-[0.04] blur-[80px]" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-4 tracking-tight animate-slide-up"
          >
            {t.landing.bottomCtaTitle}
          </h2>
          <p
            className="text-base text-[var(--text-secondary)] max-w-lg mx-auto mb-4 leading-relaxed animate-slide-up"
            style={{ animationDelay: "60ms" }}
          >
            {t.landing.bottomCtaDesc}
          </p>

          {/* Urgency line */}
          <p
            className="text-xs font-semibold text-amber-600 mb-10 animate-slide-up"
            style={{ animationDelay: "100ms" }}
          >
            {t.landing.bottomCtaWarning}
          </p>

          <div className="animate-slide-up" style={{ animationDelay: "140ms" }}>
            <Link href="/input">
              <Button size="lg">
                {t.landing.cta}
                <ChevronRight />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
