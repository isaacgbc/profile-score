"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/context/I18nContext";
import { useApp } from "@/context/AppContext";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import RewriteCard from "@/components/ui/RewriteCard";
import UnlockReveal from "@/components/ui/UnlockReveal";
import SourceToggle from "@/components/ui/SourceToggle";
import StepIndicator from "@/components/layout/StepIndicator";
import PricingModal from "@/components/pricing/PricingModal";
import EmailCaptureModal from "@/components/ui/EmailCaptureModal";
import { SparklesIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/Icons";
import type { SourceType } from "@/lib/types";

export default function RewriteStudioPage() {
  const { t } = useI18n();
  const {
    results,
    generateResults,
    isGenerating,
    generationMeta,
    isAdmin,
    setShowPricingModal,
    userImprovements,
    setUserImprovement,
    unlockAnimationTriggered,
    showEmailCaptureModal,
    setShowEmailCaptureModal,
    setUserEmail,
    userEmail,
  } = useApp();
  const router = useRouter();

  // ─── Source Toggle (URL-synced) ───
  const [activeSource, setActiveSource] = useState<SourceType>("linkedin");
  const [loading, setLoading] = useState(true);

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
      if (results.linkedinRewrites.length === 0 && results.cvRewrites.length > 0) {
        setActiveSource("cv");
      } else if (results.cvRewrites.length === 0 && results.linkedinRewrites.length > 0) {
        setActiveSource("linkedin");
      }
    }
  }, [results]);

  useEffect(() => {
    if (!results && !isGenerating) {
      let cancelled = false;
      async function run() {
        await generateResults();
        if (!cancelled) setLoading(false);
      }
      run();
      return () => { cancelled = true; };
    } else if (results) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  function handleSourceChange(source: SourceType) {
    setActiveSource(source);
    const url = new URL(window.location.href);
    url.searchParams.set("source", source);
    window.history.replaceState({}, "", url.toString());
  }

  function handleContinueToExport() {
    if (!userEmail) {
      setShowEmailCaptureModal(true);
      return;
    }
    router.push("/checkout");
  }

  function handleEmailSubmit(email: string) {
    setUserEmail(email);
    setShowEmailCaptureModal(false);
    router.push("/checkout");
  }

  // Studio labels from rewriteStudio namespace
  const studioLabels = {
    original: t.rewriteStudio.original,
    improvements: t.rewriteStudio.thingsToChange,
    improvementsPlaceholder: t.rewriteStudio.improvementsPlaceholder,
    optimized: t.rewriteStudio.optimized,
    missingSuggestionsLabel: t.rewriteStudio.missingSuggestionsLabel,
  };

  // ─── Loading ───
  if (loading || !results) {
    return (
      <div className="animate-fade-in">
        <StepIndicator currentStep="rewrite-studio" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full border-4 border-[var(--accent-light)] border-t-[var(--accent)] animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">Loading rewrites...</p>
        </div>
      </div>
    );
  }

  // ── P0-6: STRICT degraded-mode gate for Rewrite Studio ──
  // Never show fallback/placeholder rewrite content as if it were real.
  const generationHasIssues =
    generationMeta?.degraded || generationMeta?.hasFallback;

  if (generationHasIssues) {
    return (
      <div className="animate-fade-in">
        <StepIndicator currentStep="rewrite-studio" />
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
        </div>
      </div>
    );
  }

  const rewrites =
    activeSource === "linkedin"
      ? results.linkedinRewrites
      : results.cvRewrites;

  const contextLabel =
    activeSource === "linkedin"
      ? t.rewriteStudio.contextLinkedin
      : t.rewriteStudio.contextCv;

  const emptySourceLabel =
    activeSource === "linkedin" ? "LinkedIn" : "CV";

  return (
    <div className="animate-fade-in">
      <StepIndicator currentStep="rewrite-studio" />
      <PricingModal />
      <EmailCaptureModal
        isOpen={showEmailCaptureModal}
        onClose={() => setShowEmailCaptureModal(false)}
        onSubmit={handleEmailSubmit}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* ─── Header ─── */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
              <SparklesIcon size={18} className="text-[var(--accent)]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)]">
              {t.rewriteStudio.title}
            </h1>
          </div>
          <p className="text-[var(--text-secondary)]">{t.rewriteStudio.subtitle}</p>
        </div>

        {/* ─── Source Toggle (only show when both sources have rewrites) ─── */}
        {results.linkedinRewrites.length > 0 && results.cvRewrites.length > 0 && (
          <div className="flex justify-center mb-6">
            <SourceToggle
              active={activeSource}
              onChange={handleSourceChange}
            />
          </div>
        )}

        {/* ─── Context Badge ─── */}
        <div className="flex justify-center mb-8">
          <Badge variant="muted">
            {contextLabel}
          </Badge>
        </div>

        {/* ─── Rewrite Cards ─── */}
        {rewrites.length > 0 ? (
          <div className="space-y-6">
            {rewrites.map((rewrite, idx) => (
              <UnlockReveal
                key={rewrite.sectionId}
                locked={false}
                animating={unlockAnimationTriggered}
                delay={idx * 80}
              >
                <RewriteCard
                  rewrite={rewrite}
                  userImprovement={userImprovements[rewrite.sectionId]}
                  onChange={(text) =>
                    setUserImprovement(rewrite.sectionId, text)
                  }
                  locked={rewrite.locked && !isAdmin}
                  onUpgradeClick={() => setShowPricingModal(true)}
                  variant="studio"
                  labels={studioLabels}
                />
              </UnlockReveal>
            ))}
          </div>
        ) : (
          <Card variant="default" padding="lg" className="text-center">
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              {t.rewriteStudio.noRewritesAvailable.replace("{source}", emptySourceLabel)}
            </p>
            <Link href="/input">
              <Button variant="outline" size="sm">
                {t.common.back}
              </Button>
            </Link>
          </Card>
        )}

        {/* ─── Navigation ─── */}
        <div className="flex items-center justify-between mt-10 pt-6 border-t border-[var(--border-light)]">
          <Link href="/results">
            <Button variant="ghost" size="sm">
              <span className="flex items-center gap-1">
                <ChevronLeftIcon size={14} />
                {t.rewriteStudio.backToResults}
              </span>
            </Button>
          </Link>
          <Button variant="primary" size="lg" onClick={handleContinueToExport}>
            <span className="flex items-center gap-2">
              {t.rewriteStudio.continueToExport}
              <ChevronRightIcon size={16} />
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
