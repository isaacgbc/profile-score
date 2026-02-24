"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ScoreRing from "@/components/ui/ScoreRing";
import ScoreCardGrid from "@/components/ui/ScoreCardGrid";
import UnlockReveal from "@/components/ui/UnlockReveal";
import SourceToggle from "@/components/ui/SourceToggle";
import EmailCaptureModal from "@/components/ui/EmailCaptureModal";
import StepIndicator from "@/components/layout/StepIndicator";
import PricingModal from "@/components/pricing/PricingModal";
import { getSectionLabel } from "@/lib/section-labels";
import { GlobeIcon, LockIcon, SparklesIcon, ChevronRightIcon } from "@/components/ui/Icons";
import type { ScoreTier, SourceType } from "@/lib/types";

export default function ResultsPage() {
  const { t } = useI18n();
  const {
    results,
    generateMockResults,
    isAdmin,
    exportLocale,
    setShowPricingModal,
    selectedPlan,
    unlockAnimationTriggered,
    showEmailCaptureModal,
    setShowEmailCaptureModal,
    setUserEmail,
    userEmail,
  } = useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // ─── Source Toggle (URL-synced) ───
  const [activeSource, setActiveSource] = useState<SourceType>("linkedin");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    if (source === "cv" || source === "linkedin") {
      setActiveSource(source);
    }
  }, []);

  function handleSourceChange(source: SourceType) {
    setActiveSource(source);
    const url = new URL(window.location.href);
    url.searchParams.set("source", source);
    window.history.replaceState({}, "", url.toString());
  }

  const isPaid = !!selectedPlan || isAdmin;

  useEffect(() => {
    const timer = setTimeout(() => {
      generateMockResults();
      setLoading(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [generateMockResults]);

  function getTierLabel(tier: ScoreTier): string {
    const map: Record<ScoreTier, string> = {
      poor: t.results.tierPoor,
      fair: t.results.tierFair,
      good: t.results.tierGood,
      excellent: t.results.tierExcellent,
    };
    return map[tier];
  }

  function getTierBadgeVariant(
    tier: ScoreTier
  ): "warning" | "accent" | "success" | "muted" {
    const map: Record<ScoreTier, "warning" | "accent" | "success" | "muted"> = {
      poor: "warning",
      fair: "warning",
      good: "accent",
      excellent: "success",
    };
    return map[tier];
  }

  function handleEmailSubmit(email: string) {
    setUserEmail(email);
    setShowEmailCaptureModal(false);
    router.push("/checkout");
  }

  const sectionLabels = t.sectionLabels as Record<string, string>;

  // --- Loading state ---
  if (loading) {
    return (
      <div className="animate-fade-in">
        <StepIndicator currentStep="results" />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-[var(--accent-light)] border-t-[var(--accent)] animate-spin" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {isPaid ? t.results.unlockingAnimation : "Analyzing your profile..."}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            This usually takes a few seconds.
          </p>
        </div>
      </div>
    );
  }

  if (!results) return null;

  const hasCvSections =
    results.cvSections.length > 0 &&
    results.cvSections.some((s) => !s.locked);

  const totalLockedSections =
    results.linkedinSections.filter((s) => s.locked).length +
    results.cvSections.filter((s) => s.locked).length;

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep="results" />
      <PricingModal />
      <EmailCaptureModal
        isOpen={showEmailCaptureModal}
        onClose={() => setShowEmailCaptureModal(false)}
        onSubmit={handleEmailSubmit}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] mb-2">
            {t.results.title}
          </h1>
          <p className="text-[var(--text-secondary)]">{t.results.subtitle}</p>
        </div>

        {/* Export language indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <GlobeIcon size={14} className="text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)]">
            {t.results.exportingIn}:{" "}
            <strong className="text-[var(--text-secondary)]">
              {exportLocale === "en" ? "English" : "Español"}
            </strong>
          </span>
        </div>

        {/* ─── Overall Score ─── */}
        <Card variant="elevated" padding="lg" className="text-center mb-10">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-4">
            {t.results.overallScore}
          </p>
          <div className="flex justify-center mb-4">
            <ScoreRing
              score={results.overallScore}
              maxScore={results.maxScore}
              tier={results.tier}
              size="lg"
              showLabel
              label={`/ ${results.maxScore}`}
              animate
            />
          </div>
          <Badge variant={getTierBadgeVariant(results.tier)}>
            {getTierLabel(results.tier)}
          </Badge>

          <p className="mt-4 text-sm text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
            {results.linkedinSections[0]?.explanation}
          </p>

          {/* Free tier CTA */}
          {!isPaid && (
            <div className="mt-6 pt-6 border-t border-[var(--border-light)]">
              <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                {t.results.freeScoreTitle}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
                {t.results.freeScoreDesc}
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setShowPricingModal(true)}
              >
                {t.results.choosePlan}
              </Button>
            </div>
          )}
        </Card>

        {/* ─────────────────────────────────────────────────
            FREE TIER: Locked audit preview cards
            ───────────────────────────────────────────────── */}
        {!isPaid && (
          <section className="mb-10">
            {/* ATS insight banner */}
            <div className="rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 p-4 mb-6">
              <p className="text-sm text-amber-800 text-center font-medium">
                {t.results.atsInsight}
              </p>
            </div>

            {/* Preview heading */}
            <div className="text-center mb-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                {t.results.lockedPreviewTitle}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto">
                {t.results.lockedPreviewDesc}
              </p>
            </div>

            {/* LinkedIn locked previews */}
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              {t.results.linkedinAuditTitle}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {results.linkedinSections.map((section, idx) => (
                <Card
                  key={section.id}
                  variant="default"
                  padding="md"
                  locked
                  className="animate-slide-up"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <ScoreRing
                      score={section.score}
                      maxScore={section.maxScore}
                      tier={section.tier}
                      size="sm"
                      animate={false}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate">
                        {getSectionLabel(section.id, sectionLabels)}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={getTierBadgeVariant(section.tier)}>
                          {getTierLabel(section.tier)}
                        </Badge>
                        <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                          {section.score}/{section.maxScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Blurred preview hint */}
                  <div className="h-12 rounded-lg bg-gradient-to-r from-[var(--surface-secondary)] to-[var(--border-light)] opacity-40" />
                </Card>
              ))}
            </div>

            {/* CV locked previews */}
            <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
              {t.results.cvAuditTitle}
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {results.cvSections.map((section, idx) => (
                <Card
                  key={section.id}
                  variant="default"
                  padding="md"
                  locked
                  className="animate-slide-up"
                  style={{ animationDelay: `${(idx + results.linkedinSections.length) * 50}ms` }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <ScoreRing
                      score={section.score}
                      maxScore={section.maxScore}
                      tier={section.tier}
                      size="sm"
                      animate={false}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 truncate">
                        {getSectionLabel(section.id, sectionLabels)}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={getTierBadgeVariant(section.tier)}>
                          {getTierLabel(section.tier)}
                        </Badge>
                        <span className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                          {section.score}/{section.maxScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-12 rounded-lg bg-gradient-to-r from-[var(--surface-secondary)] to-[var(--border-light)] opacity-40" />
                </Card>
              ))}
            </div>

            {/* Unlock CTA */}
            <Card variant="elevated" padding="lg" className="text-center">
              <LockIcon size={24} className="text-[var(--accent)] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {t.results.lockedSectionsCount.replace("{count}", String(results.linkedinSections.length + results.cvSections.length))}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
                {t.results.lockedPreviewDesc}
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setShowPricingModal(true)}
              >
                {t.results.upgradeCta}
              </Button>
            </Card>
          </section>
        )}

        {/* ─────────────────────────────────────────────────
            PAID TIER: Source Toggle + Audit + Rewrite Studio CTA
            ───────────────────────────────────────────────── */}
        {isPaid && (
          <>
            {/* ─── Source Toggle ─── */}
            <div className="flex justify-center mb-8">
              <SourceToggle
                active={activeSource}
                onChange={handleSourceChange}
              />
            </div>

            {/* ─── Conditional Audit Grid ─── */}
            {activeSource === "linkedin" ? (
              <UnlockReveal
                locked={false}
                animating={unlockAnimationTriggered}
                delay={0}
              >
                <section className="mb-10">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    {t.results.linkedinAuditTitle}
                  </h2>
                  <ScoreCardGrid
                    sections={results.linkedinSections}
                    onUpgradeClick={() => setShowPricingModal(true)}
                  />
                </section>
              </UnlockReveal>
            ) : (
              <UnlockReveal
                locked={false}
                animating={unlockAnimationTriggered}
                delay={0}
              >
                <section className="mb-10">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                    {t.results.cvAuditTitle}
                  </h2>
                  {hasCvSections ? (
                    <ScoreCardGrid
                      sections={results.cvSections}
                      onUpgradeClick={() => setShowPricingModal(true)}
                    />
                  ) : (
                    <Card variant="default" padding="md">
                      <p className="text-sm text-[var(--text-secondary)] mb-3">
                        {t.results.noCvPrompt}
                      </p>
                      <Link href="/input">
                        <Button variant="outline" size="sm">
                          {t.results.addCvLink}
                        </Button>
                      </Link>
                    </Card>
                  )}
                </section>
              </UnlockReveal>
            )}

            {/* ─── Continue to Rewrite Studio ─── */}
            <UnlockReveal
              locked={false}
              animating={unlockAnimationTriggered}
              delay={80}
            >
              <div className="flex flex-col items-center gap-4 mb-10">
                <Link href={`/rewrite-studio?source=${activeSource}`}>
                  <Button variant="primary" size="lg">
                    <span className="flex items-center gap-2">
                      <SparklesIcon size={18} />
                      {t.results.continueToRewrite}
                      <ChevronRightIcon size={16} />
                    </span>
                  </Button>
                </Link>
                <p className="text-xs text-[var(--text-muted)] text-center">
                  {t.results.coverLetterIncluded}
                </p>
              </div>
            </UnlockReveal>
          </>
        )}

        {/* Back link */}
        <div className="text-center mt-4">
          <Link href="/features">
            <Button variant="ghost" size="sm">
              {t.common.back}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
