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
import GenerationProgress from "@/components/ui/GenerationProgress";
import { getSectionLabel } from "@/lib/section-labels";
import { GlobeIcon, LockIcon, SparklesIcon, ChevronRightIcon } from "@/components/ui/Icons";
import type { ScoreTier, SourceType } from "@/lib/types";

export default function ResultsPage() {
  const { t } = useI18n();
  const {
    results,
    generateResults,
    isGenerating,
    generationError,
    generationMeta,
    isAdmin,
    exportLocale,
    setShowPricingModal,
    selectedPlan,
    unlockAnimationTriggered,
    showEmailCaptureModal,
    setShowEmailCaptureModal,
    setUserEmail,
    userEmail,
    userInput,
    // Sprint 2: Progressive generation state
    progressStage,
    progressPercent,
    progressLabel,
    completedSections,
    totalExpectedSections,
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

  // Auto-select available source when only one exists
  useEffect(() => {
    if (results) {
      if (results.linkedinSections.length === 0 && results.cvSections.length > 0) {
        setActiveSource("cv");
      } else if (results.cvSections.length === 0 && results.linkedinSections.length > 0) {
        setActiveSource("linkedin");
      }
    }
  }, [results]);

  function handleSourceChange(source: SourceType) {
    setActiveSource(source);
    const url = new URL(window.location.href);
    url.searchParams.set("source", source);
    window.history.replaceState({}, "", url.toString());
  }

  const isPaid = !!selectedPlan || isAdmin;

  useEffect(() => {
    // Skip regeneration if results already exist in state (back-navigation guard)
    if (results) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function run() {
      await generateResults();
      if (!cancelled) setLoading(false);
    }
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // --- Error state ---
  if (generationError && !isGenerating) {
    return (
      <div className="animate-fade-in">
        <StepIndicator currentStep="results" />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-2xl">!</span>
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Generation failed
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
            {generationError}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/input">
              <Button variant="ghost">Back to input</Button>
            </Link>
            <Button
              variant="primary"
              onClick={() => {
                setLoading(true);
                generateResults().finally(() => setLoading(false));
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Loading state (Sprint 2: progressive or spinner) ---
  if (loading || isGenerating) {
    // Sprint 2: Show progressive generation UI when streaming is active
    const hasProgressData = progressStage !== null || completedSections.length > 0;

    if (hasProgressData) {
      return (
        <GenerationProgress
          stage={progressStage}
          percent={progressPercent}
          label={progressLabel}
          completedSections={completedSections}
          totalSections={totalExpectedSections}
          isPaid={isPaid}
          fileName={userInput.cvFileName || userInput.linkedinUrl || undefined}
          objective={userInput.objectiveText || undefined}
          outputLanguage={exportLocale}
        />
      );
    }

    // Fallback spinner (classic mode or before first progress event)
    return (
      <div className="animate-fade-in">
        <StepIndicator currentStep="results" />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full border-4 border-[var(--accent-light)] border-t-[var(--accent)] animate-spin" />
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {isPaid ? t.results.unlockingAnimation : "Analyzing your profile..."}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            This may take 30-60 seconds while our AI reviews your profile.
          </p>
        </div>
      </div>
    );
  }

  if (!results) return null;

  // ── P0-6: STRICT degraded-mode gate ──
  // If generation had ANY fallback or is degraded, show ONLY error state.
  // Never render fallback/placeholder content as if it were real results.
  const generationHasIssues =
    generationMeta?.degraded || generationMeta?.hasFallback;

  if (generationHasIssues) {
    return (
      <div className="animate-fade-in">
        <StepIndicator currentStep="results" />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
            <span className="text-2xl text-red-600">!</span>
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {t.results.generationFailedTitle}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
            {t.results.generationFailedDesc}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/input">
              <Button variant="ghost">{t.common.back}</Button>
            </Link>
            <Button
              variant="primary"
              onClick={() => {
                setLoading(true);
                generateResults({ forceFresh: true }).finally(() => setLoading(false));
              }}
            >
              {t.results.retryFresh}
            </Button>
          </div>
          {generationMeta?.failureReasons && generationMeta.failureReasons.length > 0 && (
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              {t.results.diagnosticHint}: {generationMeta.failureReasons.join(", ")}
            </p>
          )}
        </div>
      </div>
    );
  }

  const hasLinkedinSections = results.linkedinSections.length > 0;
  const hasCvSections = results.cvSections.length > 0;

  const totalSectionsCount =
    results.linkedinSections.length + results.cvSections.length;

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
            {results.overallDescriptor ?? results.linkedinSections[0]?.explanation ?? ""}
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
            {hasLinkedinSections && (
              <>
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
              </>
            )}

            {/* CV locked previews */}
            {hasCvSections && (
              <>
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
              </>
            )}

            {/* Unlock CTA */}
            <Card variant="elevated" padding="lg" className="text-center">
              <LockIcon size={24} className="text-[var(--accent)] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {t.results.lockedSectionsCount.replace("{count}", String(totalSectionsCount))}
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
            {/* ─── Source Toggle (only show when both sources exist) ─── */}
            {hasLinkedinSections && hasCvSections && (
              <div className="flex justify-center mb-8">
                <SourceToggle
                  active={activeSource}
                  onChange={handleSourceChange}
                />
              </div>
            )}

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
